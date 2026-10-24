package com.fit_up.health.capacitor

// GRIM_HC_BACKGROUND: dygnssammanfattning + bakgrundssynk via WorkManager.
// Installeras av scripts/patch-health-background.cjs – redigera mallen i scripts/android/.
//
// Bakgrundsläsning kräver READ_HEALTH_DATA_IN_BACKGROUND och att Health Connect
// stöder funktionen (FEATURE_READ_HEALTH_DATA_IN_BACKGROUND). Saknas något av
// dem gör workern bara det som inte kräver bakgrundsläsning (skriva väntande
// pass) och noterar orsaken – den kraschar aldrig och försöker inte igen i onödan.

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import java.util.concurrent.TimeUnit

object GrimHealthBackground {
    const val TAG = "GRIM_HC"
    const val WORK_NAME = "grim-health-background-sync"
    private const val PREFS = "grim_health_bg"
    private const val KEY_CACHE = "cache"
    private const val KEY_PENDING = "pending_writes"
    private const val KEY_INTERVAL = "interval_minutes"
    const val PERM_BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
    private const val P = "android.permission.health."

    /** Ett mått per kolumn i health_daily, med behörigheten som krävs. */
    private class Metric(val key: String, val permission: String, val metric: AggregateMetric<*>, val map: (Any?) -> Double?)

    private val metrics = listOf(
        Metric("steps", P + "READ_STEPS", StepsRecord.COUNT_TOTAL) { (it as? Long)?.toDouble() },
        Metric("activeCalories", P + "READ_ACTIVE_CALORIES_BURNED", ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL) {
            (it as? androidx.health.connect.client.units.Energy)?.inKilocalories
        },
        Metric("totalCalories", P + "READ_TOTAL_CALORIES_BURNED", TotalCaloriesBurnedRecord.ENERGY_TOTAL) {
            (it as? androidx.health.connect.client.units.Energy)?.inKilocalories
        },
        Metric("distanceM", P + "READ_DISTANCE", DistanceRecord.DISTANCE_TOTAL) {
            (it as? androidx.health.connect.client.units.Length)?.inMeters
        },
        Metric("sleepMinutes", P + "READ_SLEEP", SleepSessionRecord.SLEEP_DURATION_TOTAL) {
            (it as? java.time.Duration)?.toMinutes()?.toDouble()
        },
        Metric("avgHr", P + "READ_HEART_RATE", HeartRateRecord.BPM_AVG) { (it as? Long)?.toDouble() },
        Metric("minHr", P + "READ_HEART_RATE", HeartRateRecord.BPM_MIN) { (it as? Long)?.toDouble() },
        Metric("maxHr", P + "READ_HEART_RATE", HeartRateRecord.BPM_MAX) { (it as? Long)?.toDouble() },
        Metric("restingHr", P + "READ_RESTING_HEART_RATE", RestingHeartRateRecord.BPM_AVG) { (it as? Long)?.toDouble() },
        Metric("weightKg", P + "READ_WEIGHT", WeightRecord.WEIGHT_AVG) {
            (it as? androidx.health.connect.client.units.Mass)?.inKilograms
        },
    )

    fun isBackgroundReadAvailable(client: HealthConnectClient): Boolean = try {
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    } catch (e: Throwable) {
        false
    }

    /**
     * Dygnssummering för de senaste [days] dygnen i telefonens tidszon. Bara mått
     * med beviljad behörighet efterfrågas – annars avvisar Health Connect hela anropet.
     */
    suspend fun readDailySummary(client: HealthConnectClient, granted: Set<String>, days: Int): JSONObject {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val start = today.minusDays((days.coerceIn(1, 60) - 1).toLong()).atStartOfDay()
        val end = today.plusDays(1).atStartOfDay()
        val allowed = metrics.filter { granted.contains(it.permission) }
        val byDay = linkedMapOf<String, JSONObject>()
        var d = start.toLocalDate()
        while (d.isBefore(end.toLocalDate())) {
            byDay[d.toString()] = JSONObject().put("day", d.toString())
            d = d.plusDays(1)
        }
        if (allowed.isNotEmpty()) {
            val groups = client.aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = allowed.map { it.metric }.toSet(),
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    timeRangeSlicer = Period.ofDays(1),
                )
            )
            for (g in groups) {
                val row = byDay[g.startTime.toLocalDate().toString()] ?: continue
                for (m in allowed) {
                    if (!g.result.contains(m.metric)) continue
                    val v = m.map(g.result[m.metric]) ?: continue
                    if (!v.isNaN()) row.put(m.key, v)
                }
            }
        }
        val out = JSONObject()
        out.put("days", JSONArray(byDay.values.toList()))
        out.put("granted", JSONArray(allowed.map { it.key }))
        out.put("readAt", Instant.now().toString())
        return out
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun schedule(context: Context, intervalMinutes: Long) {
        val minutes = intervalMinutes.coerceIn(15L, 24 * 60L)
        prefs(context).edit().putLong(KEY_INTERVAL, minutes).apply()
        val request = PeriodicWorkRequestBuilder<GrimHealthSyncWorker>(minutes, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiresBatteryNotLow(true).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        Log.i(TAG, "GRIM_HC: BG_SCHEDULED every=${minutes}min")
    }

    fun cancel(context: Context) {
        prefs(context).edit().remove(KEY_INTERVAL).apply()
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        Log.i(TAG, "GRIM_HC: BG_CANCELLED")
    }

    fun scheduledInterval(context: Context): Long = prefs(context).getLong(KEY_INTERVAL, 0L)

    fun readCache(context: Context): JSONObject =
        try { JSONObject(prefs(context).getString(KEY_CACHE, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }

    private fun writeCache(context: Context, update: (JSONObject) -> Unit) {
        val c = readCache(context)
        update(c)
        prefs(context).edit().putString(KEY_CACHE, c.toString()).apply()
    }

    /** Väntande pass (JSON som writeWorkout tar emot). Senaste versionen per id vinner. */
    fun enqueuePending(context: Context, workouts: JSONArray) {
        val current = pending(context)
        val byId = linkedMapOf<String, JSONObject>()
        for (i in 0 until current.length()) current.optJSONObject(i)?.let { byId[it.optString("clientRecordId")] = it }
        for (i in 0 until workouts.length()) {
            val w = workouts.optJSONObject(i) ?: continue
            val id = w.optString("clientRecordId")
            if (id.isBlank()) continue
            val prev = byId[id]
            if (prev == null || prev.optLong("version") <= w.optLong("version")) byId[id] = w
        }
        prefs(context).edit().putString(KEY_PENDING, JSONArray(byId.values.toList()).toString()).apply()
    }

    fun pending(context: Context): JSONArray =
        try { JSONArray(prefs(context).getString(KEY_PENDING, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }

    fun inputFromJson(o: JSONObject): GrimHealthWriter.WorkoutInput = GrimHealthWriter.WorkoutInput(
        clientRecordId = o.getString("clientRecordId"),
        version = o.optLong("version", System.currentTimeMillis()),
        start = Instant.parse(o.getString("startTime")),
        end = Instant.parse(o.getString("endTime")),
        exerciseType = o.optString("exerciseType", "other"),
        title = o.optString("title").takeIf { it.isNotBlank() },
        notes = o.optString("notes").takeIf { it.isNotBlank() },
        calories = if (o.has("calories") && !o.isNull("calories")) o.optDouble("calories") else null,
        distanceMeters = if (o.has("distanceMeters") && !o.isNull("distanceMeters")) o.optDouble("distanceMeters") else null,
    )

    /** Skriver väntande pass. Misslyckade ligger kvar till nästa körning. Returnerar antal skrivna. */
    suspend fun drainPending(context: Context, client: HealthConnectClient, granted: Set<String>): Int {
        if (!granted.contains(P + "WRITE_EXERCISE")) return 0
        val list = pending(context)
        val left = JSONArray()
        var written = 0
        for (i in 0 until list.length()) {
            val o = list.optJSONObject(i) ?: continue
            try {
                GrimHealthWriter.write(
                    client, inputFromJson(o),
                    granted.contains(P + "WRITE_ACTIVE_CALORIES_BURNED"),
                    granted.contains(P + "WRITE_DISTANCE"),
                )
                written += 1
            } catch (e: Exception) {
                Log.w(TAG, "GRIM_HC: BG_WRITE_FAILED id=${o.optString("clientRecordId")}", e)
                left.put(o)
            }
        }
        prefs(context).edit().putString(KEY_PENDING, left.toString()).apply()
        return written
    }

    /** Själva bakgrundsjobbet – också anropbart från appen för test. */
    suspend fun runOnce(context: Context): JSONObject {
        val status = JSONObject().put("ranAt", Instant.now().toString())
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            status.put("result", "health-connect-unavailable")
            writeCache(context) { it.put("lastRun", status) }
            return status
        }
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        status.put("written", drainPending(context, client, granted))
        val featureOk = isBackgroundReadAvailable(client)
        status.put("backgroundFeature", featureOk)
        status.put("backgroundPermission", granted.contains(PERM_BACKGROUND))
        if (featureOk && granted.contains(PERM_BACKGROUND)) {
            val summary = readDailySummary(client, granted, 3)
            writeCache(context) { it.put("summary", summary) }
            status.put("result", "ok")
        } else {
            status.put("result", if (!featureOk) "background-read-unsupported" else "background-read-not-granted")
        }
        writeCache(context) { it.put("lastRun", status) }
        Log.i(TAG, "GRIM_HC: BG_RUN $status")
        return status
    }
}

class GrimHealthSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        kotlinx.coroutines.withTimeout(60_000) { GrimHealthBackground.runOnce(applicationContext) }
        Result.success()
    } catch (e: Exception) {
        Log.e(GrimHealthBackground.TAG, "GRIM_HC: BG_RUN_FAILED attempt=$runAttemptCount", e)
        if (runAttemptCount < 2) Result.retry() else Result.success()
    }
}
