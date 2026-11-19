package com.fit_up.health.capacitor

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter

/** Distance for one workout plus a short diagnostic string (which sources had distance). */
data class GrimWorkoutDistanceResult(val meters: Double?, val diag: String)

/**
 * Workout distance is separate from ExerciseSessionRecord. Never use daily totals.
 *
 * GRIM_WORKOUT_DISTANCE_V2: indoor cycling (Tacx/Garmin) may write the session and the distance
 * with different data origins, or write distance records that stick out a bit past the session.
 * So: read raw records from ALL origins overlapping the session, pro-rate by overlap, prefer the
 * session's own origin and otherwise use the single origin with the most distance (never sum
 * origins, they duplicate each other).
 */
object GrimWorkoutDistance {
    private const val OWN_MAX_RECORD_EXTRA_MS = 6L * 60 * 60 * 1000
    private const val OTHER_MAX_RECORD_EXTRA_MS = 15L * 60 * 1000

    suspend fun read(client: HealthConnectClient, workout: ExerciseSessionRecord): GrimWorkoutDistanceResult {
        val startMs = workout.startTime.toEpochMilli()
        val endMs = workout.endTime.toEpochMilli()
        val sessionMs = endMs - startMs
        val ownOrigin = workout.metadata.dataOrigin.packageName
        val range = TimeRangeFilter.between(workout.startTime, workout.endTime)
        val perOrigin = LinkedHashMap<String, Double>()
        val counts = LinkedHashMap<String, Int>()
        var skippedBroad = 0
        var token: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(
                recordType = DistanceRecord::class,
                timeRangeFilter = range,
                pageToken = token,
            ))
            for (record in page.records) {
                val value = record.distance.inMeters
                if (!value.isFinite() || value <= 0) continue
                val recStart = record.startTime.toEpochMilli()
                val recEnd = record.endTime.toEpochMilli()
                val recMs = recEnd - recStart
                val origin = record.metadata.dataOrigin.packageName
                val maxExtra = if (origin == ownOrigin) OWN_MAX_RECORD_EXTRA_MS else OTHER_MAX_RECORD_EXTRA_MS
                // Broad daily records from other apps would invent session distance.
                if (recMs > sessionMs + maxExtra) { skippedBroad += 1; continue }
                val share = if (recMs <= 0L) {
                    if (recStart >= startMs - 5000 && recStart <= endMs + 5000) 1.0 else 0.0
                } else {
                    val overlap = minOf(recEnd, endMs) - maxOf(recStart, startMs)
                    if (overlap <= 0L) 0.0 else overlap.toDouble() / recMs.toDouble()
                }
                if (share <= 0.0) continue
                perOrigin[origin] = (perOrigin[origin] ?: 0.0) + value * share
                counts[origin] = (counts[origin] ?: 0) + 1
            }
            token = page.pageToken
        } while (token != null)

        val own = perOrigin[ownOrigin]
        val best = perOrigin.entries.maxByOrNull { it.value }
        val meters = if (own != null && own > 0) own else best?.value
        val used = if (own != null && own > 0) ownOrigin else best?.key
        val diag = if (perOrigin.isEmpty()) {
            "no DistanceRecord overlaps session (skippedBroad=$skippedBroad)"
        } else {
            "used=$used; " + perOrigin.entries.joinToString(", ") {
                "${it.key}=${Math.round(it.value)}m/${counts[it.key]}rec"
            } + "; skippedBroad=$skippedBroad"
        }
        // Missing is not zero.
        return GrimWorkoutDistanceResult(meters?.takeIf { it.isFinite() && it > 0 }, diag)
    }
}
