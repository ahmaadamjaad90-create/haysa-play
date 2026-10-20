import { useEffect, useRef, useState } from "react";
import { PanResponder, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { Stroke } from "@/lib/draw";

// لوح الرسم: الكل بيشوف، والرسّام بس بيرسم
export function DrawCanvas({
  size,
  strokes,
  canDraw,
  color,
  width,
  onBegin,
  onMove,
  onEnd,
}: {
  size: number;
  strokes: Stroke[];
  canDraw: boolean;
  color: string;
  width: number;
  onBegin: (c: string, w: number, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
}) {
  const k = size / 1000;
  // آخر قيم بالـ ref عشان الـ PanResponder ينعمل مرة وحدة
  const live = useRef({
    canDraw,
    color,
    width,
    size,
    onBegin,
    onMove,
    onEnd,
    last: [0, 0],
  });
  useEffect(() => {
    live.current = {
      ...live.current,
      canDraw,
      color,
      width,
      size,
      onBegin,
      onMove,
      onEnd,
    };
  });

  // الـ ref بينقرا بس جوا أحداث اللمس، مش وقت الرسم
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const toUnit = (v: number) =>
      Math.max(0, Math.min(1000, Math.round((v / live.current.size) * 1000)));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => live.current.canDraw,
      onMoveShouldSetPanResponder: () => live.current.canDraw,
      onPanResponderGrant: (e) => {
        const x = toUnit(e.nativeEvent.locationX);
        const y = toUnit(e.nativeEvent.locationY);
        live.current.last = [x, y];
        live.current.onBegin(live.current.color, live.current.width, x, y);
      },
      onPanResponderMove: (e) => {
        const x = toUnit(e.nativeEvent.locationX);
        const y = toUnit(e.nativeEvent.locationY);
        const [lx, ly] = live.current.last;
        if (Math.abs(x - lx) + Math.abs(y - ly) < 6) return;
        live.current.last = [x, y];
        live.current.onMove(x, y);
      },
      onPanResponderRelease: () => live.current.onEnd(),
      onPanResponderTerminate: () => live.current.onEnd(),
    });
  });

  return (
    <View
      style={[styles.board, { width: size, height: size }, NO_SCROLL]}
      {...pan.panHandlers}
    >
      <Svg width={size} height={size} pointerEvents="none">
        {strokes.map((s) => {
          if (s.p.length <= 2) {
            return (
              <Circle
                key={s.id}
                cx={s.p[0] * k}
                cy={s.p[1] * k}
                r={(s.w * k) / 2}
                fill={s.c}
              />
            );
          }
          let d = `M${s.p[0] * k} ${s.p[1] * k}`;
          for (let i = 2; i < s.p.length; i += 2)
            d += ` L${s.p[i] * k} ${s.p[i + 1] * k}`;
          return (
            <Path
              key={s.id}
              d={d}
              stroke={s.c}
              strokeWidth={s.w * k}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        })}
      </Svg>
    </View>
  );
}

// على الويب: الإصبع بيرسم بدل ما يحرّك الصفحة
const NO_SCROLL = Platform.OS === "web" ? ({ touchAction: "none" } as unknown as ViewStyle) : null;

const styles = StyleSheet.create({
  board: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    direction: "ltr",
  },
});
