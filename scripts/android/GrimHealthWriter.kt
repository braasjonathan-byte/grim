package com.fit_up.health.capacitor

// GRIM_HC_WRITE: skriver Grim-pass till Health Connect.
// Installeras av scripts/patch-health-write.cjs – redigera mallen i scripts/android/.
// Alla poster får clientRecordId + clientRecordVersion, så samma pass kan skrivas
// om (redigering) utan dubbletter: Health Connect ersätter posten när versionen är högre.

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Length
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

object GrimHealthWriter {
    const val SESSION_SUFFIX = ""
    const val CALORIES_SUFFIX = "-kcal"
    const val DISTANCE_SUFFIX = "-dist"

    data class WorkoutInput(
        val clientRecordId: String,
        val version: Long,
        val start: Instant,
        val end: Instant,
        val exerciseType: String,
        val title: String?,
        val notes: String?,
        val calories: Double?,
        val distanceMeters: Double?,
    )

    fun exerciseTypeFor(key: String): Int = when (key.lowercase()) {
        "running", "löpning" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING
        "treadmill" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL
        "biking", "cykling" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING
        "biking_stationary" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        "strength", "styrka" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        "weightlifting" -> ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING
        "swimming", "simning" -> ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL
        "swimming_open_water" -> ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER
        "walking", "promenad" -> ExerciseSessionRecord.EXERCISE_TYPE_WALKING
        "hiking" -> ExerciseSessionRecord.EXERCISE_TYPE_HIKING
        "rowing" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE
        "hiit", "interval" -> ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
        "yoga" -> ExerciseSessionRecord.EXERCISE_TYPE_YOGA
        "stairs" -> ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE
        "elliptical" -> ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL
        "skiing" -> ExerciseSessionRecord.EXERCISE_TYPE_SKIING
        "calisthenics" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
        else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
    }

    private fun offsetAt(instant: Instant): ZoneOffset = ZoneId.systemDefault().rules.getOffset(instant)

    /** Bygger posterna. Kalorier/distans tas bara med om behörighet finns och värdet är > 0. */
    fun buildRecords(w: WorkoutInput, allowCalories: Boolean, allowDistance: Boolean): List<Record> {
        require(w.end.isAfter(w.start)) { "end must be after start" }
        val so = offsetAt(w.start)
        val eo = offsetAt(w.end)
        val records = mutableListOf<Record>()
        records.add(
            ExerciseSessionRecord(
                w.start, so, w.end, eo,
                Metadata.manualEntry(w.clientRecordId + SESSION_SUFFIX, w.version),
                exerciseTypeFor(w.exerciseType),
                w.title?.take(100),
                w.notes?.take(1000),
            )
        )
        val kcal = w.calories
        if (allowCalories && kcal != null && kcal > 0 && kcal < 100_000) {
            records.add(
                ActiveCaloriesBurnedRecord(
                    w.start, so, w.end, eo,
                    Energy.kilocalories(kcal),
                    Metadata.manualEntry(w.clientRecordId + CALORIES_SUFFIX, w.version),
                )
            )
        }
        val meters = w.distanceMeters
        if (allowDistance && meters != null && meters > 0 && meters < 1_000_000) {
            records.add(
                DistanceRecord(
                    w.start, so, w.end, eo,
                    Length.meters(meters),
                    Metadata.manualEntry(w.clientRecordId + DISTANCE_SUFFIX, w.version),
                )
            )
        }
        return records
    }

    /** insertRecords med samma clientRecordId och högre version ersätter befintlig post (upsert). */
    suspend fun write(client: HealthConnectClient, w: WorkoutInput, allowCalories: Boolean, allowDistance: Boolean): List<String> {
        val records = buildRecords(w, allowCalories, allowDistance)
        val ids = client.insertRecords(records).recordIdsList
        // Kalorier/distans kan ha tagits bort i Grim sedan förra versionen – rensa då gamla poster.
        if (allowCalories && records.none { it is ActiveCaloriesBurnedRecord }) {
            client.deleteRecords(ActiveCaloriesBurnedRecord::class, emptyList(), listOf(w.clientRecordId + CALORIES_SUFFIX))
        }
        if (allowDistance && records.none { it is DistanceRecord }) {
            client.deleteRecords(DistanceRecord::class, emptyList(), listOf(w.clientRecordId + DISTANCE_SUFFIX))
        }
        return ids
    }

    suspend fun delete(client: HealthConnectClient, clientRecordIds: List<String>, allowCalories: Boolean, allowDistance: Boolean) {
        if (clientRecordIds.isEmpty()) return
        client.deleteRecords(ExerciseSessionRecord::class, emptyList(), clientRecordIds.map { it + SESSION_SUFFIX })
        if (allowCalories) client.deleteRecords(ActiveCaloriesBurnedRecord::class, emptyList(), clientRecordIds.map { it + CALORIES_SUFFIX })
        if (allowDistance) client.deleteRecords(DistanceRecord::class, emptyList(), clientRecordIds.map { it + DISTANCE_SUFFIX })
    }
}
