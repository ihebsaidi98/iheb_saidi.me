"use client";

import { useEffect, useState } from "react";

const normalizeTimeZone = (value: string) => {
  if (!value) return "Africa/Tunis";
  if (value === "GMT+1" || value === "GMT-1") return "Africa/Tunis";
  return value;
};

export function useLocalTime(timeZone = "Africa/Tunis") {
  const [time, setTime] = useState("--:--:--");
  const safeTimeZone = normalizeTimeZone(timeZone);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: safeTimeZone,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [safeTimeZone]);

  return time;
}