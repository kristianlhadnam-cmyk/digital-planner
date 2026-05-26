import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  Text,
  ScrollView,
  Dimensions,
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

const MAX_POINTS_PER_PATH = 1000;
const MAX_PATHS = 500;
const MIN_DISTANCE = 1.5;

export default function HandwritingCanvas({
  initialDrawings = [],
  onDrawingsChange,
  height = 400,
  showLines = true,
  lineSpacing = 30,
  editable = true,
}: HandwritingCanvasProps) {
  const [paths, setPaths] = useState<DrawingPath[]>(initialDrawings);
  const [currentPathPoints, setCurrentPathPoints] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const pathsRef = useRef<DrawingPath[]>(initialDrawings);
  const currentPathRef = useRef<Point[]>([]);
  const selectedColorRef = useRef(selectedColor);
  const selectedSizeRef = useRef(selectedSize);
  const isEraserRef = useRef(isEraser);
  const lastPointRef = useRef<Point | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (initialDrawings && initialDrawings.length > 0) {
      setPaths(initialDrawings);
      pathsRef.current = initialDrawings;
    }
  }, []);

  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    selectedSizeRef.current = selectedSize;
  }, [selectedSize]);

  useEffect(() => {
    isEraserRef.current = isEraser;
  }, [isEraser]);

  const shouldAddPoint = (newPoint: Point): boolean => {
    if (!lastPointRef.current) return true;
    const dx = newPoint.x - lastPointRef.current.x;
    const dy = newPoint.y - lastPointRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance >= MIN_DISTANCE;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onStartShouldSetPanResponderCapture: () => editable,
      onMoveShouldSetPanResponderCapture: () => editable,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt) => {
        try {
          const { locationX, locationY } = evt.nativeEvent;
          const point = { x: locationX, y: locationY };

          if (isEraserRef.current) {
            eraseAtPoint(locationX, locationY);
          } else {
            isDrawingRef.current = true;
            currentPathRef.current = [point];
            lastPointRef.current = point;
            setCurrentPathPoints([point]);
          }
        } catch (e) {
          console.log('Grant error:', e);
        }
      },

      onPanResponderMove: (evt) => {
        try {
          const { locationX, locationY } = evt.nativeEvent;
          const point = { x: locationX, y: locationY };

          if (isEraserRef.current) {
            eraseAtPoint(locationX, locationY);
            return;
          }

          if (!isDrawingRef.current) return;

          if (currentPathRef.current.length >= MAX_POINTS_PER_PATH) {
            return;
          }

          if (shouldAddPoint(point)) {
            currentPathRef.current = [...currentPathRef.current, point];
            lastPointRef.current = point;
            setCurrentPathPoints(currentPathRef.current);
          }
        } catch (e) {
          console.log('Move error:', e);
        }
      },

      onPanResponderRelease: () => {
        try {
          if (isEraserRef.current) {
            isDrawingRef.current = false;
            return;
          }

          if (currentPathRef.current.length > 0) {
            const newPath: DrawingPath = {
              id: uuidv4(),
              points: currentPathRef.current.slice(),
              color: selectedColorRef.current,
              strokeWidth: selectedSizeRef.current,
            };

            const newPaths = [...pathsRef.current, newPath];
            pathsRef.current = newPaths;

            setPaths(newPaths);
            setCurrentPathPoints([]);
            setRenderTrigger((prev) => prev + 1);

            if (onDrawingsChange) {
              setTimeout(() => {
                onDrawingsChange(newPaths);
              }, 0);
            }
          } else {
            setCurrentPathPoints([]);
          }

          currentPathRef.current = [];
          lastPointRef.current = null;
          isDrawingRef.current = false;
        } catch (e) {
          console.log('Release error:', e);
          currentPathRef.current = [];
          lastPointRef.current = null;
          isDrawingRef.current = false;
          setCurrentPathPoints([]);
        }
      },

      onPanResponderTerminate: () => {
        try {
          if (currentPathRef.current.length > 0 && !isEraserRef.current) {
            const newPath: DrawingPath = {
              id: uuidv4(),
              points: currentPathRef.current.slice(),
              color: selectedColorRef.current,
              strokeWidth: selectedSizeRef.current,
            };
            const newPaths = [...pathsRef.current, newPath];
            pathsRef.current = newPaths;
            setPaths(newPaths);
            if (onDrawingsChange) {
              setTimeout(() => onDrawingsChange(newPaths), 0);
            }
          }
          currentPathRef.current = [];
          lastPointRef.current = null;
          isDrawingRef.current = false;
          setCurrentPathPoints([]);
        } catch (e) {
          console.log('Terminate error:', e);
        }
      },
    })
  ).current;

  const eraseAtPoint = useCallback(
    (x: number, y: number) => {
      try {
        const eraserRadius = 25;
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
          if (onDrawingsChange) {
            onDrawingsChange(filtered);
          }
        }
      } catch (e) {
        console.log('Erase error:', e);
      }
    },
    [onDrawingsChange]
  );

  const pointsToSvgPath = (points: Point[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      const p = points[0];
      return `M ${p.x} ${p.y} L ${p.x + 0.5} ${p.y + 0.5}`;
    }
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;
    return path;
  };

  const clearCanvas = () => {
    pathsRef.current = [];
    setPaths([]);
    setCurrentPathPoints([]);
    if (onDrawingsChange) {
      onDrawingsChange([]);
    }
  };

  const undoLast = () => {
    const updated = pathsRef.current.slice(0, -1);
    pathsRef.current = updated;
    setPaths(updated);
    if (onDrawingsChange) {
      onDrawingsChange(updated);
    }
  };

  const numberOfLines = Math.floor(height / lineSpacing);
  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.wrapper}>
      {editable && (
        <TouchableOpacity
          style={styles.toolbarToggle}
          onPress={() => setShowToolbar(!showToolbar)}
        >
          <Text style={styles.toolbarToggleText}>
            {showToolbar ? '✕ Hide Tools' : '✏️ Drawing Tools'}
            {paths.length > 0 ? `  (${paths.length} strokes)` : ''}
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
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height={height}
          pointerEvents="none"
        >
          {showLines &&
            Array.from({ length: numberOfLines }, (_, i) => (
              <Line
                key={`line-${i}`}
                x1="0"
                y1={(i + 1) * lineSpacing}
                x2={screenWidth + 100}
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

          {currentPathPoints.length > 0 && (
            <Path
              key="current-drawing"
              d={pointsToSvgPath(currentPathPoints)}
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
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#ffffff',
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
    overflow: 'hidden',
  },
});
