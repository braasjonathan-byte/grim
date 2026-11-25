package com.fit_up.health.capacitor

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.CyclingPedalingCadenceRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import org.json.JSONArray
import kotlin.reflect.KClass

/**
 * GRIM_WORKOUT_SERIES_V1: time series for the pulse analysis of one workout.
 *
 * - distance: [startMs, endMs, meters] DistanceRecords from one origin (session origin first,
 *   otherwise the origin with most distance; origins duplicate each other so never sum them)
 * - speed / power / cadence: [ms, value] samples, only when that read permission is granted
 * - hrAfter: [ms, bpm] heart rate for 3 minutes after the session (recovery)
 *
 * Every part is optional: a missing permission or failed read leaves that part out.
 */
object GrimWorkoutSeries {
    private const val MAX_SAMPLES = 20000
    private const val AFTER_MS = 3L * 60 * 1000
    private const val OTHER_MAX_RECORD_EXTRA_MS = 15L * 60 * 1000

    private const val PERM_DISTANCE = "android.permission.health.READ_DISTANCE"
    private const val PERM_HEART_RATE = "android.permission.health.READ_HEART_RATE"
    private const val PERM_SPEED = "android.permission.health.READ_SPEED"
    private const val PERM_POWER = "android.permission.health.READ_POWER"
    private const val PERM_CADENCE = "android.permission.health.READ_CYCLING_PEDALING_CADENCE"

    private suspend fun <T : Record> readAll(client: HealthConnectClient, type: KClass<T>, range: TimeRangeFilter): List<T> {
        val out = ArrayList<T>()
        var token: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(recordType = type, timeRangeFilter = range, pageToken = token))
            out.addAll(page.records)
            token = page.pageToken
        } while (token != null && out.size < MAX_SAMPLES)
        return out
    }

    /** Samples from the session origin when it has any, otherwise from the origin with most samples. */
    private fun <S> pickOrigin(perOrigin: Map<String, List<S>>, ownOrigin: String): List<S> {
        perOrigin[ownOrigin]?.takeIf { it.isNotEmpty() }?.let { return it }
        return perOrigin.values.maxByOrNull { it.size } ?: emptyList()
    }

    private fun pairs(samples: List<Pair<Long, Double>>): JSONArray {
        val arr = JSONArray()
        for ((t, v) in samples.sortedBy { it.first }.take(MAX_SAMPLES)) {
            if (!v.isFinite()) continue
            arr.put(JSONArray().put(t).put(Math.round(v * 100.0) / 100.0))
        }
        return arr
    }

    suspend fun read(client: HealthConnectClient, workout: ExerciseSessionRecord, granted: Set<String>): JSObject {
        val result = JSObject()
        val ownOrigin = workout.metadata.dataOrigin.packageName
        val startMs = workout.startTime.toEpochMilli()
        val endMs = workout.endTime.toEpochMilli()
        val sessionMs = endMs - startMs
        val range = TimeRangeFilter.between(workout.startTime, workout.endTime)

        if (granted.contains(PERM_DISTANCE)) {
            try {
                val perOrigin = LinkedHashMap<String, MutableList<Triple<Long, Long, Double>>>()
                for (r in readAll(client, DistanceRecord::class, range)) {
                    val m = r.distance.inMeters
                    val s = r.startTime.toEpochMilli()
                    val e = r.endTime.toEpochMilli()
                    if (!m.isFinite() || m <= 0) continue
                    val origin = r.metadata.dataOrigin.packageName
                    if (origin != ownOrigin && e - s > sessionMs + OTHER_MAX_RECORD_EXTRA_MS) continue
                    perOrigin.getOrPut(origin) { ArrayList() }.add(Triple(s, e, m))
                }
                val own = perOrigin[ownOrigin]
                val chosen = if (!own.isNullOrEmpty()) own else perOrigin.values.maxByOrNull { list -> list.sumOf { it.third } }
                if (!chosen.isNullOrEmpty()) {
                    val arr = JSONArray()
                    for ((s, e, m) in chosen.sortedBy { it.first }.take(MAX_SAMPLES)) {
                        arr.put(JSONArray().put(s).put(e).put(Math.round(m * 10.0) / 10.0))
                    }
                    result.put("distance", arr)
                }
            } catch (e: Exception) {
                result.put("distanceError", e.message ?: e.javaClass.simpleName)
            }
        }

        if (granted.contains(PERM_SPEED)) {
            try {
                val perOrigin = LinkedHashMap<String, MutableList<Pair<Long, Double>>>()
                for (r in readAll(client, SpeedRecord::class, range)) {
                    val list = perOrigin.getOrPut(r.metadata.dataOrigin.packageName) { ArrayList() }
                    for (s in r.samples) list.add(Pair(s.time.toEpochMilli(), s.speed.inMetersPerSecond))
                }
                val chosen = pickOrigin(perOrigin, ownOrigin)
                if (chosen.isNotEmpty()) result.put("speed", pairs(chosen))
            } catch (e: Exception) {
                result.put("speedError", e.message ?: e.javaClass.simpleName)
            }
        }

        if (granted.contains(PERM_POWER)) {
            try {
                val perOrigin = LinkedHashMap<String, MutableList<Pair<Long, Double>>>()
                for (r in readAll(client, PowerRecord::class, range)) {
                    val list = perOrigin.getOrPut(r.metadata.dataOrigin.packageName) { ArrayList() }
                    for (s in r.samples) list.add(Pair(s.time.toEpochMilli(), s.power.inWatts))
                }
                val chosen = pickOrigin(perOrigin, ownOrigin)
                if (chosen.isNotEmpty()) result.put("power", pairs(chosen))
            } catch (e: Exception) {
                result.put("powerError", e.message ?: e.javaClass.simpleName)
            }
        }

        if (granted.contains(PERM_CADENCE)) {
            try {
                val perOrigin = LinkedHashMap<String, MutableList<Pair<Long, Double>>>()
                for (r in readAll(client, CyclingPedalingCadenceRecord::class, range)) {
                    val list = perOrigin.getOrPut(r.metadata.dataOrigin.packageName) { ArrayList() }
                    for (s in r.samples) list.add(Pair(s.time.toEpochMilli(), s.revolutionsPerMinute))
                }
                val chosen = pickOrigin(perOrigin, ownOrigin)
                if (chosen.isNotEmpty()) result.put("cadence", pairs(chosen))
            } catch (e: Exception) {
                result.put("cadenceError", e.message ?: e.javaClass.simpleName)
            }
        }

        if (granted.contains(PERM_HEART_RATE)) {
            try {
                val after = TimeRangeFilter.between(workout.endTime, workout.endTime.plusMillis(AFTER_MS))
                val samples = ArrayList<Pair<Long, Double>>()
                for (r in readAll(client, HeartRateRecord::class, after)) {
                    for (s in r.samples) {
                        val t = s.time.toEpochMilli()
                        if (t >= endMs && t <= endMs + AFTER_MS) samples.add(Pair(t, s.beatsPerMinute.toDouble()))
                    }
                }
                if (samples.isNotEmpty()) result.put("hrAfter", pairs(samples))
            } catch (e: Exception) {
                result.put("hrAfterError", e.message ?: e.javaClass.simpleName)
            }
        }

        result.put("marker", "GRIM_WORKOUT_SERIES_V1")
        return result
    }
}
