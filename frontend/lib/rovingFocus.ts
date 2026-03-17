import { RefObject, useEffect, useRef, useState } from "react";

export function useRovingFocus<T extends HTMLElement>(options: {
  itemCount: number;
  initialIndex?: number;
}) {
  const { itemCount, initialIndex = 0 } = options;
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, Math.max(itemCount - 1, 0))),
  );
  const itemRefs = useRef<Array<T | null>>([]);

  useEffect(() => {
    if (itemCount <= 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.max(0, Math.min(current, itemCount - 1)));
  }, [itemCount]);

  function register(index: number) {
    return (el: T | null) => {
      itemRefs.current[index] = el;
    };
  }

  function focusIndex(index: number) {
    const target = itemRefs.current[index];
    target?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (itemCount <= 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => {
        const next = Math.min(itemCount - 1, current + 1);
        queueMicrotask(() => focusIndex(next));
        return next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => {
        const next = Math.max(0, current - 1);
        queueMicrotask(() => focusIndex(next));
        return next;
      });
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(() => {
        queueMicrotask(() => focusIndex(0));
        return 0;
      });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(() => {
        const last = Math.max(itemCount - 1, 0);
        queueMicrotask(() => focusIndex(last));
        return last;
      });
      return;
    }
  }

  return {
    activeIndex,
    setActiveIndex,
    register,
    onKeyDown,
    tabIndexFor: (index: number) => (index === activeIndex ? 0 : -1),
  };
}

