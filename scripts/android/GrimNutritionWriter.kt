package com.fit_up.health.capacitor

// GRIM_HC_NUTRITION: skriver Grims kost (per måltid och dag) och vatten (per dag) till Health Connect.
// Installeras av scripts/patch-health-nutrition-write.cjs – redigera mallen i scripts/android/.
// clientRecordId + version gör skrivningen idempotent: samma dag skrivs om när totalsumman ändras.

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Volume
import java.time.Instant
import java.time.ZoneId

object GrimNutritionWriter {
    data class MealInput(
        val clientRecordId: String, val version: Long, val start: Instant, val end: Instant,
        val mealType: String, val name: String?, val kcal: Double,
        val protein: Double?, val fat: Double?, val carbs: Double?, val fiber: Double?, val sugar: Double?,
    )
    data class WaterInput(val clientRecordId: String, val version: Long, val start: Instant, val end: Instant, val ml: Double)

    private fun off(i: Instant) = ZoneId.systemDefault().rules.getOffset(i)
    private fun g(v: Double?) = v?.takeIf { it > 0 && it < 10_000 }?.let { Mass.grams(it) }

    fun mealTypeFor(key: String): Int = when (key.lowercase()) {
        "frukost", "breakfast" -> MealType.MEAL_TYPE_BREAKFAST
        "lunch" -> MealType.MEAL_TYPE_LUNCH
        "middag", "dinner" -> MealType.MEAL_TYPE_DINNER
        "mellanmål", "snack", "kvällsmål" -> MealType.MEAL_TYPE_SNACK
        else -> MealType.MEAL_TYPE_UNKNOWN
    }

    suspend fun writeMeals(client: HealthConnectClient, meals: List<MealInput>): Int {
        val records = meals.filter { it.end.isAfter(it.start) && it.kcal >= 0 && it.kcal < 50_000 }.map { m ->
            NutritionRecord(
                startTime = m.start, startZoneOffset = off(m.start),
                endTime = m.end, endZoneOffset = off(m.end),
                metadata = Metadata.manualEntry(m.clientRecordId, m.version),
                energy = Energy.kilocalories(m.kcal),
                protein = g(m.protein), totalFat = g(m.fat), totalCarbohydrate = g(m.carbs),
                dietaryFiber = g(m.fiber), sugar = g(m.sugar),
                name = m.name?.take(100), mealType = mealTypeFor(m.mealType),
            )
        }
        if (records.isEmpty()) return 0
        return client.insertRecords(records).recordIdsList.size
    }

    suspend fun writeWater(client: HealthConnectClient, items: List<WaterInput>): Int {
        val records = items.filter { it.end.isAfter(it.start) && it.ml > 0 && it.ml < 20_000 }.map { w ->
            HydrationRecord(
                startTime = w.start, startZoneOffset = off(w.start),
                endTime = w.end, endZoneOffset = off(w.end),
                volume = Volume.milliliters(w.ml),
                metadata = Metadata.manualEntry(w.clientRecordId, w.version),
            )
        }
        if (records.isEmpty()) return 0
        return client.insertRecords(records).recordIdsList.size
    }

    suspend fun deleteNutrition(client: HealthConnectClient, ids: List<String>) {
        if (ids.isNotEmpty()) client.deleteRecords(NutritionRecord::class, emptyList(), ids)
    }
    suspend fun deleteWater(client: HealthConnectClient, ids: List<String>) {
        if (ids.isNotEmpty()) client.deleteRecords(HydrationRecord::class, emptyList(), ids)
    }
}
