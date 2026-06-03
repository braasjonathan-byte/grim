import { useEffect, useState } from "react";
import {
  connectHeartRate,
  disconnectHeartRate,
  getHeartRateSnapshot,
  subscribeHeartRate,
} from "@/lib/heartRate";

export const useHeartRate = () => {
  const [snap, setSnap] = useState(getHeartRateSnapshot());
  useEffect(() => subscribeHeartRate(() => setSnap(getHeartRateSnapshot())), []);
  return {
    ...snap,
    connect: connectHeartRate,
    disconnect: disconnectHeartRate,
  };
};
