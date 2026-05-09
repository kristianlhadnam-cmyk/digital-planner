// FILE: digital-planner/src/components/HandwritingCanvas.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { DrawingPath, Point } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';

interface HandwritingCanvasProps {
  initialDrawings?: DrawingPath[];
  onDrawingsChange?: (drawings: DrawingPath[]) => void;
  height?: number;
  showLines?: boolean;
  lineSpacing?: number;
  editable?: boolean;
}

export default function HandwritingCanvas({
  initialDrawings = [],
  onDrawingsChange,
  height = 400,
  showLines = true,
  lineSpacing = 30,
  editable = true,
}: HandwritingCanvasProps) {
  const [paths, setPaths] = useState<DrawingPath[]>(initialDrawings);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const pathsRef = useRef<DrawingPath[]>(initialDrawings);

  useEffect(() => {
    setPaths(initialDrawings);
    pathsRef.current = initialDrawings;
  }, []);

  const selectedColorRef = useRef(selectedColor);
  const selectedSizeRef = useRef(selectedSize);
  const isEraserRef = useRef(isEraser);

  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    selectedSizeRef.current = selectedSize;
  }, [selectedSize]);

  useEffect(() => {
    isEraserRef.current = isEraser;
  }, [isEraser]);

  const currentPathRef = useRef<Point[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (isEraserRef.current) {
          eraseAtPoint(locationX, locationY);
        } else {
          currentPathRef.current = [{ x: locationX, y: locationY }];
          setCurrentPath([{ x: locationX, y: locationY }]);
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (isEraserRef.current) {
          eraseAtPoint(locationX, locationY);
        } else {
          const newPoint = { x: locationX, y: locationY };
          currentPathRef.current = [...currentPathRef.current, newPoint];
          setCurrentPath((prev) => [...prev, newPoint]);
        }
      },
      onPanResponderRelease: () => {
        if (!isEraserRef.current && currentPathRef.current.length > 0) {
          const newPath: DrawingPath = {
            id: uuidv4(),
            points: currentPathRef.current,
            color: selectedColorRef.current,
            strokeWidth: selectedSizeRef.current,
          };
          const updatedPaths = [...pathsRef.current, newPath];
          pathsRef.current = updatedPaths;
          setPaths(updatedPaths);
          onDrawingsChange?.(updatedPaths);
        }
        currentPathRef.current = [];
        setCurrentPath([]);
      },
    })
  ).current;

  const eraseAtPoint = useCallback(
    (x: number, y: number) => {
      const eraserRadius = 20;
      const filtered = pathsRef.current.filter((path) => {
        return !path.points.some(
          (p) =>
            Math.abs(p.x - x) < eraserRadius &&
            Math.abs(p.y - y) < eraserRadius
        );
      });
      if (filtered.length !== pathsRef.current.length) {
        pathsRef.current = filtered;
        setPaths(filtered);
        onDrawingsChange?.(filtered);
      }
    },
    [onDrawingsChange]
  );

  const pointsToSvgPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${
        points[0].y + 0.1
      }`;
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;
    return path;
  };

  const clearCanvas = () => {
    pathsRef.current = [];
    setPaths([]);
    onDrawingsChange?.([]);
  };

  const undoLast = () => {
    const updated = pathsRef.current.slice(0, -1);
    pathsRef.current = updated;
    setPaths(updated);
    onDrawingsChange?.(updated);
  };

  const numberOfLines = Math.floor(height / lineSpacing);

  return (
    <View style={styles.wrapper}>
      {editable && (
        <TouchableOpacity
          style={styles.toolbarToggle}
          onPress={() => setShowToolbar(!showToolbar)}
        >
          <Text style={styles.toolbarToggleText}>
            {showToolbar ? '✕ Hide Tools' : '✏️ Drawing Tools'}
            {paths.length > 0 && `  (${paths.length} strokes)`}
          </Text>
        </TouchableOpacity>
      )}

      {editable && showToolbar && (
        <View style={styles.toolbar}>
          <View style={styles.toolRow}>
            <Text style={styles.toolLabel}>Color:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.colorRow}>
                {PEN_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      selectedColor === color &&
                        !isEraser &&
                        styles.selectedColor,
                    ]}
                    onPress={() => {
                      setSelectedColor(color);
                      setIsEraser(false);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.toolRow}>
            <Text style={styles.toolLabel}>Size:</Text>
            <View style={styles.sizeRow}>
              {PEN_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeButton,
                    selectedSize === size && styles.selectedSize,
                  ]}
                  onPress={() => setSelectedSize(size)}
                >
                  <View
                    style={[
                      styles.sizeDot,
                      { width: size * 2.5, height: size * 2.5 },
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.toolBtn, isEraser && styles.activeToolBtn]}
                onPress={() => setIsEraser(!isEraser)}
              >
                <Text style={styles.toolBtnText}>🧹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={undoLast}>
                <Text style={styles.toolBtnText}>↩️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={clearCanvas}>
                <Text style={styles.toolBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View
        style={[styles.canvas, { height }]}
        {...panResponder.panHandlers}
        collapsable={false}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {showLines &&
            Array.from({ length: numberOfLines }, (_, i) => (
              <Line
                key={`line-${i}`}
                x1="0"
                y1={(i + 1) * lineSpacing}
                x2="2000"
                y2={(i + 1) * lineSpacing}
                stroke={COLORS.canvasLine}
                strokeWidth="0.7"
              />
            ))}

          {paths.map((path) => (
            <Path
              key={path.id}
              d={pointsToSvgPath(path.points)}
              stroke={path.color}
              strokeWidth={path.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {currentPath.length > 0 && (
            <Path
              d={pointsToSvgPath(currentPath)}
              stroke={selectedColor}
              strokeWidth={selectedSize}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.canvasLine,
  },
  toolbarToggle: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  toolbarToggleText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  toolbar: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 8,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    width: 40,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: COLORS.white,
    transform: [{ scale: 1.2 }],
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSize: {
    borderColor: COLORS.highlight,
  },
  sizeDot: {
    borderRadius: 20,
    backgroundColor: COLORS.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeToolBtn: {
    borderColor: COLORS.highlight,
    backgroundColor: COLORS.todayBg,
  },
  toolBtnText: {
    fontSize: 16,
  },
  canvas: {
    backgroundColor: COLORS.canvasBg,
    width: '100%',
  },
});