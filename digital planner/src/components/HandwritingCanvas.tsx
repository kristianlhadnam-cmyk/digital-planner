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
  const [allPaths, setAllPaths] = useState<DrawingPath[]>(initialDrawings);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  const allPathsRef = useRef<DrawingPath[]>(initialDrawings);
  const currentPointsRef = useRef<Point[]>([]);
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const eraserRef = useRef(isEraser);

  useEffect(() => {
    colorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    sizeRef.current = selectedSize;
  }, [selectedSize]);

  useEffect(() => {
    eraserRef.current = isEraser;
  }, [isEraser]);

  const generateId = () => {
    return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onStartShouldSetPanResponderCapture: () => editable,
      onMoveShouldSetPanResponderCapture: () => editable,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const filtered = allPathsRef.current.filter((p) => {
            return !p.points.some(
              (pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25
            );
          });
          if (filtered.length !== allPathsRef.current.length) {
            allPathsRef.current = filtered;
            setAllPaths(filtered);
            onDrawingsChange?.(filtered);
          }
        } else {
          currentPointsRef.current = [{ x, y }];
          setCurrentPoints([{ x, y }]);
        }
      },

      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const filtered = allPathsRef.current.filter((p) => {
            return !p.points.some(
              (pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25
            );
          });
          if (filtered.length !== allPathsRef.current.length) {
            allPathsRef.current = filtered;
            setAllPaths(filtered);
            onDrawingsChange?.(filtered);
          }
          return;
        }

        const lastPoint =
          currentPointsRef.current[currentPointsRef.current.length - 1];
        if (lastPoint) {
          const dx = x - lastPoint.x;
          const dy = y - lastPoint.y;
          if (dx * dx + dy * dy < 2) return;
        }

        currentPointsRef.current = [...currentPointsRef.current, { x, y }];
        setCurrentPoints([...currentPointsRef.current]);
      },

      onPanResponderRelease: () => {
        if (eraserRef.current) return;

        if (currentPointsRef.current.length > 0) {
          const newPath: DrawingPath = {
            id: generateId(),
            points: [...currentPointsRef.current],
            color: colorRef.current,
            strokeWidth: sizeRef.current,
          };

          const updated = [...allPathsRef.current, newPath];
          allPathsRef.current = updated;
          setAllPaths(updated);
          onDrawingsChange?.(updated);
        }

        currentPointsRef.current = [];
        setCurrentPoints([]);
      },

      onPanResponderTerminate: () => {
        if (currentPointsRef.current.length > 0 && !eraserRef.current) {
          const newPath: DrawingPath = {
            id: generateId(),
            points: [...currentPointsRef.current],
            color: colorRef.current,
            strokeWidth: sizeRef.current,
          };
          const updated = [...allPathsRef.current, newPath];
          allPathsRef.current = updated;
          setAllPaths(updated);
          onDrawingsChange?.(updated);
        }
        currentPointsRef.current = [];
        setCurrentPoints([]);
      },
    })
  ).current;

  const pointsToPath = (points: Point[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${
        points[0].y + 0.5
      }`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const clearAll = () => {
    allPathsRef.current = [];
    setAllPaths([]);
    onDrawingsChange?.([]);
  };

  const undoLast = () => {
    const updated = allPathsRef.current.slice(0, -1);
    allPathsRef.current = updated;
    setAllPaths(updated);
    onDrawingsChange?.(updated);
  };

  const numLines = Math.floor(height / lineSpacing);

  return (
    <View style={styles.wrapper}>
      {editable && (
        <TouchableOpacity
          style={styles.toolbarToggle}
          onPress={() => setShowToolbar(!showToolbar)}
        >
          <Text style={styles.toolbarToggleText}>
            {showToolbar ? '✕ Hide Tools' : '✏️ Drawing Tools'}
            {allPaths.length > 0 ? `  (${allPaths.length} strokes)` : ''}
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
                      styles.colorBtn,
                      { backgroundColor: color },
                      selectedColor === color &&
                        !isEraser &&
                        styles.colorSelected,
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
                    styles.sizeBtn,
                    selectedSize === size && styles.sizeSelected,
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
                style={[styles.actionBtn, isEraser && styles.actionBtnActive]}
                onPress={() => setIsEraser(!isEraser)}
              >
                <Text style={styles.actionText}>🧹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={undoLast}>
                <Text style={styles.actionText}>↩️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={clearAll}>
                <Text style={styles.actionText}>🗑️</Text>
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
        <Svg
          width="100%"
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {showLines &&
            Array.from({ length: numLines }, (_, i) => (
              <Line
                key={`l-${i}`}
                x1="0"
                y1={(i + 1) * lineSpacing}
                x2="3000"
                y2={(i + 1) * lineSpacing}
                stroke={COLORS.canvasLine}
                strokeWidth="0.7"
              />
            ))}

          {allPaths.map((path) => (
            <Path
              key={path.id}
              d={pointsToPath(path.points)}
              stroke={path.color}
              strokeWidth={path.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {currentPoints.length > 0 && (
            <Path
              d={pointsToPath(currentPoints)}
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
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
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
  colorBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.2 }],
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sizeSelected: {
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
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionBtnActive: {
    borderColor: COLORS.highlight,
    backgroundColor: COLORS.todayBg,
  },
  actionText: {
    fontSize: 16,
  },
  canvas: {
    backgroundColor: COLORS.canvasBg,
    width: '100%',
    overflow: 'hidden',
  },
});
