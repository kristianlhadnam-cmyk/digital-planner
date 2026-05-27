import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import Pdf from 'react-native-pdf';
import Svg, { Path } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import { RootStackParamList, DrawingPath, PdfAnnotation, Point } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import { getNote, updateNote } from '../services/StorageService';
import { PanResponder } from 'react-native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PdfViewer'>;
  route: RouteProp<RootStackParamList, 'PdfViewer'>;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PDF_HEIGHT = SCREEN_HEIGHT - 280;

const generateId = (): string => {
  return `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export default function PdfViewerScreen({ navigation, route }: Props) {
  const { noteId, pdfUri, pdfName } = route.params;
  
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[2]); // Red by default
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showToolbar, setShowToolbar] = useState(false);

  const annotationsRef = useRef<PdfAnnotation[]>([]);
  const currentPathRef = useRef<Point[]>([]);
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const eraserRef = useRef(isEraser);
  const pageRef = useRef(currentPage);
  const drawingModeRef = useRef(isDrawingMode);

  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { sizeRef.current = selectedSize; }, [selectedSize]);
  useEffect(() => { eraserRef.current = isEraser; }, [isEraser]);
  useEffect(() => { pageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { drawingModeRef.current = isDrawingMode; }, [isDrawingMode]);

  useEffect(() => {
    loadAnnotations();
  }, [noteId]);

  const loadAnnotations = async () => {
    try {
      const note = await getNote(noteId);
      if (note && note.pdfAnnotations) {
        annotationsRef.current = note.pdfAnnotations;
        setAnnotations(note.pdfAnnotations);
      }
    } catch (e) {
      console.log('Load annotations error:', e);
    }
  };

  const saveAnnotations = async (newAnnotations: PdfAnnotation[]) => {
    try {
      await updateNote(noteId, { pdfAnnotations: newAnnotations });
    } catch (e) {
      console.log('Save annotations error:', e);
    }
  };

  const getCurrentPageDrawings = (): DrawingPath[] => {
    const pageAnnotation = annotations.find(a => a.pageNumber === currentPage);
    return pageAnnotation?.drawings || [];
  };

  const updateCurrentPageDrawings = (newDrawings: DrawingPath[]) => {
    let updated = [...annotationsRef.current];
    const index = updated.findIndex(a => a.pageNumber === pageRef.current);
    
    if (index >= 0) {
      updated[index] = { ...updated[index], drawings: newDrawings };
    } else {
      updated.push({ pageNumber: pageRef.current, drawings: newDrawings });
    }
    
    annotationsRef.current = updated;
    setAnnotations(updated);
    saveAnnotations(updated);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawingModeRef.current,
      onMoveShouldSetPanResponder: () => drawingModeRef.current,
      onStartShouldSetPanResponderCapture: () => drawingModeRef.current,
      onMoveShouldSetPanResponderCapture: () => drawingModeRef.current,

      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const pageDrawings = annotationsRef.current.find(
            a => a.pageNumber === pageRef.current
          )?.drawings || [];
          
          const filtered = pageDrawings.filter((p) => {
            return !p.points.some(
              (pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25
            );
          });
          
          if (filtered.length !== pageDrawings.length) {
            updateCurrentPageDrawings(filtered);
          }
        } else {
          currentPathRef.current = [{ x, y }];
          setCurrentPath([{ x, y }]);
        }
      },

      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const pageDrawings = annotationsRef.current.find(
            a => a.pageNumber === pageRef.current
          )?.drawings || [];
          
          const filtered = pageDrawings.filter((p) => {
            return !p.points.some(
              (pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25
            );
          });
          
          if (filtered.length !== pageDrawings.length) {
            updateCurrentPageDrawings(filtered);
          }
          return;
        }

        const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
        if (lastPoint) {
          const dx = x - lastPoint.x;
          const dy = y - lastPoint.y;
          if (dx * dx + dy * dy < 2) return;
        }

        currentPathRef.current = [...currentPathRef.current, { x, y }];
        setCurrentPath([...currentPathRef.current]);
      },

      onPanResponderRelease: () => {
        if (eraserRef.current) return;

        if (currentPathRef.current.length > 0) {
          const newPath: DrawingPath = {
            id: generateId(),
            points: [...currentPathRef.current],
            color: colorRef.current,
            strokeWidth: sizeRef.current,
          };

          const pageDrawings = annotationsRef.current.find(
            a => a.pageNumber === pageRef.current
          )?.drawings || [];
          
          updateCurrentPageDrawings([...pageDrawings, newPath]);
        }

        currentPathRef.current = [];
        setCurrentPath([]);
      },

      onPanResponderTerminate: () => {
        currentPathRef.current = [];
        setCurrentPath([]);
      },
    })
  ).current;

  const pointsToPath = (points: Point[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const clearCurrentPage = () => {
    Alert.alert(
      'Clear Page',
      `Clear all annotations on page ${currentPage}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => updateCurrentPageDrawings([]),
        },
      ]
    );
  };

  const undoLast = () => {
    const pageDrawings = annotationsRef.current.find(
      a => a.pageNumber === currentPage
    )?.drawings || [];
    
    if (pageDrawings.length > 0) {
      updateCurrentPageDrawings(pageDrawings.slice(0, -1));
    }
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(pdfUri);
      } else {
        Alert.alert('Not Available', 'Sharing is not available on this device.');
      }
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const currentPageDrawings = getCurrentPageDrawings();

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        title={pdfName}
      />

      {/* Top Toolbar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.modeBtn, !isDrawingMode && styles.modeBtnActive]}
          onPress={() => {
            setIsDrawingMode(false);
            setIsEraser(false);
          }}
        >
          <Text style={[styles.modeBtnText, !isDrawingMode && styles.modeBtnTextActive]}>
            👁️ View
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.modeBtn, isDrawingMode && !isEraser && styles.modeBtnActive]}
          onPress={() => {
            setIsDrawingMode(true);
            setIsEraser(false);
          }}
        >
          <Text style={[styles.modeBtnText, isDrawingMode && !isEraser && styles.modeBtnTextActive]}>
            ✏️ Draw
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, isDrawingMode && isEraser && styles.modeBtnActive]}
          onPress={() => {
            setIsDrawingMode(true);
            setIsEraser(true);
          }}
        >
          <Text style={[styles.modeBtnText, isDrawingMode && isEraser && styles.modeBtnTextActive]}>
            🧹 Erase
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
          <Text style={styles.iconText}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Drawing Tools (when drawing mode) */}
      {isDrawingMode && !isEraser && (
        <View style={styles.drawingTools}>
          <View style={styles.toolGroup}>
            <Text style={styles.toolLabel}>Color:</Text>
            {PEN_COLORS.slice(0, 5).map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorBtn,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>
          
          <View style={styles.toolGroup}>
            <Text style={styles.toolLabel}>Size:</Text>
            {PEN_SIZES.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeBtn,
                  selectedSize === size && styles.sizeSelected,
                ]}
                onPress={() => setSelectedSize(size)}
              >
                <View style={[styles.sizeDot, { width: size * 2.5, height: size * 2.5 }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* PDF Container with Overlay */}
      <View style={styles.pdfContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.highlight} />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        )}

        <Pdf
          source={{ uri: pdfUri, cache: true }}
          page={currentPage}
          onLoadComplete={(pages) => {
            setTotalPages(pages);
            setLoading(false);
          }}
          onPageChanged={(page) => {
            setCurrentPage(page);
          }}
          onError={(error) => {
            console.log('PDF error:', error);
            Alert.alert('Error', 'Could not load PDF: ' + String(error));
            setLoading(false);
          }}
          style={styles.pdf}
          enablePaging={true}
          horizontal={false}
          singlePage={true}
        />

        {/* Drawing Overlay */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'transparent' },
          ]}
          {...(isDrawingMode ? panResponder.panHandlers : {})}
          pointerEvents={isDrawingMode ? 'auto' : 'none'}
        >
          <Svg
            width="100%"
            height="100%"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {currentPageDrawings.map((path) => (
              <Path
                key={path.id}
                d={pointsToPath(path.points)}
                stroke={path.color}
                strokeWidth={path.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ))}
            {currentPath.length > 0 && (
              <Path
                d={pointsToPath(currentPath)}
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

      {/* Bottom Bar - Page Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
          onPress={goToPrevPage}
          disabled={currentPage === 1}
        >
          <Text style={styles.pageBtnText}>← Prev</Text>
        </TouchableOpacity>

        <View style={styles.pageInfo}>
          <Text style={styles.pageInfoText}>
            Page {currentPage} of {totalPages}
          </Text>
          {currentPageDrawings.length > 0 && (
            <Text style={styles.annotationCount}>
              ✏️ {currentPageDrawings.length} annotations
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
          onPress={goToNextPage}
          disabled={currentPage === totalPages}
        >
          <Text style={styles.pageBtnText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      {isDrawingMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={undoLast}>
            <Text style={styles.actionBtnText}>↩️ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={clearCurrentPage}>
            <Text style={styles.actionBtnText}>🗑️ Clear Page</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  topBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modeBtnActive: {
    backgroundColor: COLORS.highlight,
    borderColor: COLORS.highlight,
  },
  modeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: COLORS.white,
  },
  iconBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iconText: {
    fontSize: 16,
  },

  drawingTools: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    flexWrap: 'wrap',
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  colorBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
  sizeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
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

  pdfContainer: {
    flex: 1,
    backgroundColor: '#525252',
    position: 'relative',
  },
  pdf: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },

  bottomBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pageInfo: {
    alignItems: 'center',
  },
  pageInfoText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  annotationCount: {
    color: COLORS.highlight,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  actionBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
