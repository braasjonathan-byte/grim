package com.fit_up.health.capacitor

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter

/** Workout distance is separate from ExerciseSessionRecord. Never use daily totals. */
object GrimWorkoutDistance {
    suspend fun read(client: HealthConnectClient, workout: ExerciseSessionRecord): Double? {
        val origin = setOf(workout.metadata.dataOrigin)
        val range = TimeRangeFilter.between(workout.startTime, workout.endTime)
        // Read raw records first: some indoor cycling providers are omitted by aggregation.
        var token: String? = null
        var meters = 0.0
        do {
            val page = client.readRecords(ReadRecordsRequest(
                recordType = DistanceRecord::class,
                timeRangeFilter = range,
                dataOriginFilter = origin,
                pageToken = token,
            ))
            for (record in page.records) {
                // Exclude broad daily records and neighbouring workouts. Allow timestamp rounding.
                if (record.startTime.isBefore(workout.startTime.minusSeconds(5)) ||
                    record.endTime.isAfter(workout.endTime.plusSeconds(5))) continue
                val value = record.distance.inMeters
                if (value.isFinite() && value > 0) meters += value
            }
            token = page.pageToken
        } while (token != null)
        // Missing is not zero; aggregating a broad daily record would invent session distance.
        return meters.takeIf { it.isFinite() && it > 0 }
    }
}