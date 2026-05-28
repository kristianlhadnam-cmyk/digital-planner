import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList, DrawingPath, PdfAnnotation, Point } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import { getNote, updateNote } from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PdfViewer'>;
  route: RouteProp<RootStackParamList, 'PdfViewer'>;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const generateId = (): string => {
  return `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

export default function PdfViewerScreen({ navigation, route }: Props) {
  const { noteId, pdfUri, pdfName } = route.params;

  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[2]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const annotationsRef = useRef<PdfAnnotation[]>([]);
  const currentPathRef = useRef<Point[]>([]);
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const eraserRef = useRef(isEraser);
  const pageRef = useRef(currentPage);
  const drawingModeRef = useRef(isDrawingMode);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { sizeRef.current = selectedSize; }, [selectedSize]);
  useEffect(() => { eraserRef.current = isEraser; }, [isEraser]);
  useEffect(() => { pageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { drawingModeRef.current = isDrawingMode; }, [isDrawingMode]);

  useEffect(() => {
    loadAnnotations();
    loadPdfAsBase64();
  }, [noteId, pdfUri]);

  const loadPdfAsBase64 = async () => {
    try {
      setLoading(true);
      const info = await FileSystem.getInfoAsync(pdfUri);
      if (!info.exists) {
        setError('PDF file not found');
        setLoading(false);
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setPdfBase64(base64);
    } catch (e: any) {
      console.log('Load PDF error:', e);
      setError('Could not load PDF: ' + String(e.message || e));
      setLoading(false);
    }
  };

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

  const clearCurrentPage = () => {
    Alert.alert(
      'Clear Page',
      `Clear annotations on page ${currentPage}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => updateCurrentPageDrawings([]) },
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

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    webViewRef.current?.injectJavaScript(`renderPage(${page}, ${zoomLevel}); true;`);
  };

  const zoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex(z => z >= zoomLevel);
    const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
    const newZoom = ZOOM_LEVELS[nextIndex];
    setZoomLevel(newZoom);
    webViewRef.current?.injectJavaScript(`renderPage(${currentPage}, ${newZoom}); true;`);
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex(z => z >= zoomLevel);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const newZoom = ZOOM_LEVELS[prevIndex];
    setZoomLevel(newZoom);
    webViewRef.current?.injectJavaScript(`renderPage(${currentPage}, ${newZoom}); true;`);
  };

  const resetZoom = () => {
    setZoomLevel(1.0);
    webViewRef.current?.injectJavaScript(`renderPage(${currentPage}, 1.0); true;`);
  };

  const fitToScreen = () => {
    setZoomLevel(1.0);
    webViewRef.current?.injectJavaScript(`fitToScreen(${currentPage}); true;`);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        setTotalPages(data.totalPages);
        setLoading(false);
      } else if (data.type === 'pageChanged') {
        setCurrentPage(data.page);
      } else if (data.type === 'error') {
        setError(data.message);
        setLoading(false);
      } else if (data.type === 'zoomChanged') {
        setZoomLevel(data.zoom);
      }
    } catch (e) {
      console.log('Parse message error:', e);
    }
  };

  const generateHtml = (base64: string): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html {
      width: 100%;
      height: 100%;
      background: #525252;
      overflow: auto;
    }
    #pdf-container {
      width: 100%;
      min-height: 100%;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 10px;
    }
    canvas {
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      max-width: none;
    }
    #loading {
      color: white;
      font-family: sans-serif;
      font-size: 16px;
      text-align: center;
      padding-top: 50%;
    }
  </style>
</head>
<body>
  <div id="pdf-container">
    <div id="loading">Loading PDF...</div>
    <canvas id="pdf-canvas" style="display:none;"></canvas>
  </div>

  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    let pdfDoc = null;
    let currentRenderPage = 1;
    let currentZoom = 1.0;
    let baseScale = 1.0;
    let canvas = document.getElementById('pdf-canvas');
    let ctx = canvas.getContext('2d');
    let loadingDiv = document.getElementById('loading');

    function base64ToUint8Array(base64) {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    function sendMessage(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    async function loadPdf() {
      try {
        const pdfData = base64ToUint8Array('${base64}');
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        pdfDoc = await loadingTask.promise;
        
        sendMessage({
          type: 'loaded',
          totalPages: pdfDoc.numPages
        });
        
        loadingDiv.style.display = 'none';
        canvas.style.display = 'block';
        await fitToScreen(1);
      } catch (error) {
        sendMessage({
          type: 'error',
          message: error.message || 'Failed to load PDF'
        });
        loadingDiv.textContent = 'Error: ' + error.message;
      }
    }

    async function fitToScreen(pageNum) {
      if (!pdfDoc) return;
      try {
        currentRenderPage = pageNum;
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        
        const containerWidth = window.innerWidth - 20;
        const containerHeight = window.innerHeight - 20;
        const scaleX = containerWidth / viewport.width;
        const scaleY = containerHeight / viewport.height;
        baseScale = Math.min(scaleX, scaleY) * 0.95;
        currentZoom = 1.0;
        
        await renderAtScale(pageNum, baseScale);
        sendMessage({ type: 'zoomChanged', zoom: 1.0 });
      } catch (error) {
        sendMessage({ type: 'error', message: 'Render error: ' + error.message });
      }
    }

    async function renderPage(pageNum, zoom) {
      if (!pdfDoc) return;
      try {
        if (zoom !== currentZoom || pageNum !== currentRenderPage) {
          currentZoom = zoom;
          currentRenderPage = pageNum;
        }
        
        const actualScale = baseScale * zoom;
        await renderAtScale(pageNum, actualScale);
      } catch (error) {
        sendMessage({ type: 'error', message: 'Render error: ' + error.message });
      }
    }

    async function renderAtScale(pageNum, scale) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      sendMessage({ type: 'pageChanged', page: pageNum });
    }

    loadPdf();

    window.addEventListener('resize', () => {
      if (pdfDoc) {
        fitToScreen(currentRenderPage);
      }
    });
  </script>
</body>
</html>
    `;
  };

  const currentPageDrawings = getCurrentPageDrawings();

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <CalendarHeader onHomePress={() => navigation.navigate('Home')} title="PDF Error" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could Not Load PDF</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back to Note</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader onHomePress={() => navigation.navigate('Home')} title={pdfName} />

      {/* Top Toolbar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.modeBtn, !isDrawingMode && styles.modeBtnActive]}
          onPress={() => { setIsDrawingMode(false); setIsEraser(false); }}
        >
          <Text style={[styles.modeBtnText, !isDrawingMode && styles.modeBtnTextActive]}>
            👁️ View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, isDrawingMode && !isEraser && styles.modeBtnActive]}
          onPress={() => { setIsDrawingMode(true); setIsEraser(false); }}
        >
          <Text style={[styles.modeBtnText, isDrawingMode && !isEraser && styles.modeBtnTextActive]}>
            ✏️ Draw
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, isDrawingMode && isEraser && styles.modeBtnActive]}
          onPress={() => { setIsDrawingMode(true); setIsEraser(true); }}
        >
          <Text style={[styles.modeBtnText, isDrawingMode && isEraser && styles.modeBtnTextActive]}>
            🧹 Erase
          </Text>
        </TouchableOpacity>
      </View>

      {/* ZOOM CONTROLS */}
      <View style={styles.zoomBar}>
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} disabled={zoomLevel <= ZOOM_LEVELS[0]}>
          <Text style={[styles.zoomBtnText, zoomLevel <= ZOOM_LEVELS[0] && styles.disabled]}>
            ➖
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.zoomLevelBtn} onPress={resetZoom}>
          <Text style={styles.zoomLevelText}>
            {Math.round(zoomLevel * 100)}%
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} disabled={zoomLevel >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>
          <Text style={[styles.zoomBtnText, zoomLevel >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] && styles.disabled]}>
            ➕
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fitBtn} onPress={fitToScreen}>
          <Text style={styles.fitBtnText}>📐 Fit</Text>
        </TouchableOpacity>
      </View>

      {/* Drawing Tools */}
      {isDrawingMode && !isEraser && (
        <View style={styles.drawingTools}>
          <Text style={styles.toolLabel}>Color:</Text>
          {PEN_COLORS.slice(0, 5).map((color) => (
            <TouchableOpacity
              key={color}
              style={[styles.colorBtn, { backgroundColor: color }, selectedColor === color && styles.colorSelected]}
              onPress={() => setSelectedColor(color)}
            />
          ))}
          <Text style={[styles.toolLabel, { marginLeft: 12 }]}>Size:</Text>
          {PEN_SIZES.map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.sizeBtn, selectedSize === size && styles.sizeSelected]}
              onPress={() => setSelectedSize(size)}
            >
              <View style={[styles.sizeDot, { width: size * 2, height: size * 2 }]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* PDF Container */}
      <View style={styles.pdfContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.highlight} />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        )}

        {pdfBase64 && (
          <WebView
            ref={webViewRef}
            source={{ html: generateHtml(pdfBase64) }}
            style={styles.webview}
            onMessage={handleWebViewMessage}
            onError={(e) => { setError('WebView error: ' + e.nativeEvent.description); }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={false}
            scrollEnabled={!isDrawingMode}
            bounces={false}
            mixedContentMode="always"
          />
        )}

        {/* Drawing Overlay - Only active in draw mode */}
        {isDrawingMode && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
            {...panResponder.panHandlers}
            pointerEvents="auto"
          >
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
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
        )}

        {/* Show drawings in view mode (non-interactive) */}
        {!isDrawingMode && currentPageDrawings.length > 0 && (
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
          </Svg>
        )}
      </View>

      {/* Page Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
          onPress={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <Text style={styles.pageBtnText}>← Prev</Text>
        </TouchableOpacity>
        <View style={styles.pageInfo}>
          <Text style={styles.pageInfoText}>Page {currentPage} of {totalPages}</Text>
          {currentPageDrawings.length > 0 && (
            <Text style={styles.annotationCount}>✏️ {currentPageDrawings.length} strokes</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
          onPress={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <Text style={styles.pageBtnText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons when drawing */}
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

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorIcon: { fontSize: 64, marginBottom: 16 },
  errorTitle: { color: COLORS.error, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  errorMessage: { color: COLORS.text, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  backBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  backBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },

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
    paddingHorizontal: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modeBtnActive: { backgroundColor: COLORS.highlight, borderColor: COLORS.highlight },
  modeBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: COLORS.white },

  zoomBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtn: {
    width: 44,
    height: 36,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  zoomBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.3 },
  zoomLevelBtn: {
    minWidth: 80,
    height: 36,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  zoomLevelText: { color: COLORS.highlight, fontSize: 14, fontWeight: '700' },
  fitBtn: {
    paddingHorizontal: 14,
    height: 36,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },

  drawingTools: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toolLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginRight: 4 },
  colorBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: '#ffffff', transform: [{ scale: 1.15 }] },
  sizeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  sizeSelected: { borderColor: COLORS.highlight },
  sizeDot: { borderRadius: 20, backgroundColor: COLORS.text },

  pdfContainer: { flex: 1, backgroundColor: '#525252', position: 'relative' },
  webview: { flex: 1, backgroundColor: '#525252' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, zIndex: 10,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 12 },

  bottomBar: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 10,
    justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: COLORS.accent, borderRadius: 8 },
  pageBtnDisabled: { opacity: 0.3 },
  pageBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  pageInfo: { alignItems: 'center' },
  pageInfoText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  annotationCount: { color: COLORS.highlight, fontSize: 11, fontWeight: '600', marginTop: 2 },

  actionBar: {
    flexDirection: 'row', backgroundColor: COLORS.secondary,
    paddingHorizontal: 12, paddingVertical: 8, gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  actionBtn: {
    flex: 1, paddingVertical: 10, backgroundColor: COLORS.cardBg,
    borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  actionBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
});
