import { useEffect, useState } from "react";
import { today as getToday } from "./utils";

export default function useToday() {
  const [today, setToday] = useState(getToday());

  useEffect(() => {
    const update = () => setToday(getToday()); // same value = no re-render
    const id = setInterval(update, 60 * 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return today;
}
