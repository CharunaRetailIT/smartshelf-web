import { Injectable } from '@angular/core';
import { ActiveSelection, Canvas, Circle, FabricImage, FabricObject, FabricObjectProps, FabricText, Group, Rect } from '../../../../node_modules/fabric';
@Injectable({
  providedIn: 'root'
})
export class FabricCanvasService {
private canvas: Canvas | null = null;

  // initCanvas(canvasElement: HTMLCanvasElement): Canvas {
  //   this.canvas = new Canvas(canvasElement, {
  //     width: 800,
  //     height: 600,
  //     backgroundColor: 'white',
  //     selection: true, // Enable group selection
  //   });
    
  //   // Enable multi-selection with ctrl/cmd key
  //   this.canvas.on('selection:created', () => this.onSelectionChanged());
  //   this.canvas.on('selection:updated', () => this.onSelectionChanged());
  //   this.canvas.on('selection:cleared', () => this.onSelectionChanged());
    
  //   return this.canvas;
  // }

  // fabric-canvas.service.ts
initCanvas(canvasElement: HTMLCanvasElement, width?: number, height?: number): Canvas {
  this.dispose();
  
  this.canvas = new Canvas(canvasElement, {
    width: width || canvasElement.width || 800,
    height: height || canvasElement.height || 480,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true
  });
  
  // Enable multi-selection with ctrl/cmd key
  this.canvas.on('selection:created', () => this.onSelectionChanged());
  this.canvas.on('selection:updated', () => this.onSelectionChanged());
  this.canvas.on('selection:cleared', () => this.onSelectionChanged());
  
  return this.canvas;
}

// Optional: Add a method to resize existing canvas
resizeCanvas(width: number, height: number): void {
  if (this.canvas) {
    this.canvas.setDimensions({
      width: width,
      height: height
    });
    this.canvas.calcOffset();
    this.canvas.renderAll();
  }
}


  getCanvas(): Canvas | null {
    return this.canvas;
  }

  // Selection Methods
  selectAll(): void {
    if (!this.canvas) return;
    const allObjects = this.canvas.getObjects();
    if (allObjects.length > 1) {
      const selection = new ActiveSelection(allObjects, {
        canvas: this.canvas,
      });
      this.canvas.setActiveObject(selection);
      this.canvas.requestRenderAll();
    } else if (allObjects.length === 1) {
      this.canvas.setActiveObject(allObjects[0]);
    }
  }

  getSelectedObjects(): FabricObject[] {
    if (!this.canvas) return [];
    const activeObject = this.canvas.getActiveObject();
    
    if (activeObject) {
      if (activeObject.type === 'activeSelection') {
        return (activeObject as ActiveSelection).getObjects();
      } else {
        return [activeObject];
      }
    }
    return [];
  }

  hasSelection(): boolean {
    return this.getSelectedObjects().length > 0;
  }

  private onSelectionChanged(): void {
    // Emit event or callback for UI updates
    // You can extend this to notify components about selection changes
  }

  // Enhanced Text Methods
  addText(text: string, options?: any): void {
    if (!this.canvas) return;
    
    const textObj = new FabricText(text, {
      left: 50,
      top: 50,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: '#000000',
      fontWeight: 'normal',
      fontStyle: 'normal',
      underline: false,
      linethrough: false,
      textAlign: 'left',
      ...options
    });
    
    this.canvas.add(textObj);
    this.canvas.setActiveObject(textObj);
  }

  updateTextStyle(property: string, value: any): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
        obj.set(property, value);
      }
    });
    this.canvas?.requestRenderAll();
  }

  // Color Management Methods
  changeFillColor(color: string): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.set('fill', color);
    });
    this.canvas!.requestRenderAll();
  }

  changeStrokeColor(color: string): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.set('stroke', color);
    });
    this.canvas?.requestRenderAll();
  }

  changeStrokeWidth(width: number): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.set('strokeWidth', width);
    });
    this.canvas?.requestRenderAll();
  }

  // Border Style Methods
  setBorderStyle(dashPattern: number[]): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.set('strokeDashArray', dashPattern);
    });
    this.canvas?.requestRenderAll();
  }

  setBorderRadius(radius: number): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      if (obj.type === 'rect') {
        obj.set('rx', radius);
        obj.set('ry', radius);
      }
    });
    this.canvas?.requestRenderAll();
  }

  // Enhanced Shape Methods
  addRectangle(options?: any): void {
    if (!this.canvas) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 2,
      rx: 0,
      ry: 0,
      ...options
    });
    
    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
  }

  addCircle(options?: any): void {
    if (!this.canvas) return;
    
    const circle = new Circle({
      left: 200,
      top: 200,
      radius: 50,
      fill: '#00ff00',
      stroke: '#000000',
      strokeWidth: 2,
      ...options
    });
    
    this.canvas.add(circle);
    this.canvas.setActiveObject(circle);
  }

  addImage(imageUrl: string, options?: any): void {
    if (!this.canvas) return;
    
    FabricImage.fromURL(imageUrl, {}, options)
      .then((img: FabricImage) => {
        img.set({
          left: 300,
          top: 300,
          scaleX: 0.5,
          scaleY: 0.5,
          ...options
        });

        this.canvas!.add(img);
        this.canvas!.setActiveObject(img);
      });
  }

  // Layer Management
  bringToFront(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
        if (obj === undefined) return;
      this.canvas?.bringObjectToFront(obj);
    });
  }

  sendToBack(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      this.canvas?.sendObjectToBack(obj);
    });
  }

  bringForward(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      this.canvas?.bringObjectToFront(obj);
    });
  }

  sendBackward(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      this.canvas?.sendObjectBackwards(obj);
    });
  }

  // Alignment Methods
  alignLeft(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length < 2) return;
    
    const leftmost = Math.min(...selectedObjects.map(obj => obj.left!));
    selectedObjects.forEach(obj => {
      obj.set('left', leftmost);
    });
    this.canvas?.requestRenderAll();
  }

  alignRight(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length < 2) return;
    
    const rightmost = Math.max(...selectedObjects.map(obj => (obj.left! + obj.getScaledWidth())));
    selectedObjects.forEach(obj => {
      obj.set('left', rightmost - obj.getScaledWidth());
    });
    this.canvas?.requestRenderAll();
  }

  alignCenter(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length < 2) return;
    
    const bounds = this.getSelectionBounds(selectedObjects);
    const centerX = bounds.left + bounds.width / 2;
    
    selectedObjects.forEach(obj => {
      obj.set('left', centerX - obj.getScaledWidth() / 2);
    });
    this.canvas?.requestRenderAll();
  }

  alignTop(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length < 2) return;
    
    const topmost = Math.min(...selectedObjects.map(obj => obj.top!));
    selectedObjects.forEach(obj => {
      obj.set('top', topmost);
    });
    this.canvas?.requestRenderAll();
  }

  alignBottom(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length < 2) return;
    
    const bottommost = Math.max(...selectedObjects.map(obj => (obj.top! + obj.getScaledHeight())));
    selectedObjects.forEach(obj => {
      obj.set('top', bottommost - obj.getScaledHeight());
    });
    this.canvas?.requestRenderAll();
  }

  alignMiddle(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length < 2) return;
    
    const bounds = this.getSelectionBounds(selectedObjects);
    const centerY = bounds.top + bounds.height / 2;
    
    selectedObjects.forEach(obj => {
      obj.set('top', centerY - obj.getScaledHeight() / 2);
    });
    this.canvas?.requestRenderAll();
  }

  private getSelectionBounds(objects: FabricObject[]) {
    const left = Math.min(...objects.map(obj => obj.left!));
    const top = Math.min(...objects.map(obj => obj.top!));
    const right = Math.max(...objects.map(obj => obj.left! + obj.getScaledWidth()));
    const bottom = Math.max(...objects.map(obj => obj.top! + obj.getScaledHeight()));
    
    return {
      left,
      top,
      width: right - left,
      height: bottom - top
    };
  }

  // Grouping Methods
//   groupSelected(): void {
//     if (!this.canvas) return;
//     const activeObject = this.canvas.getActiveObject();
    
//     if (activeObject && activeObject.type === 'activeSelection') {
//       const group = (activeObject as ActiveSelection).toGroup();
//       this.canvas.requestRenderAll();
//     }
//   }

groupSelected(): void {
  if (!this.canvas) return;
  
  // Get all selected objects
  const selectedObjects = this.canvas.getActiveObjects();
  
  if (selectedObjects.length > 1) {
    // Create a group from selected objects
    const group = new Group(selectedObjects, {
      // Optional group configuration
      // left: calculatedLeft,
      // top: calculatedTop,
    });
    
    // Remove individual objects and add the group
    this.canvas.discardActiveObject();
    selectedObjects.forEach(obj => this.canvas?.remove(obj));
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    
    this.canvas.requestRenderAll();
  }
}
  ungroupSelected(): void {
    if (!this.canvas) return;
    const activeObject = this.canvas.getActiveObject();
    
    if (activeObject && activeObject.type === 'group') {
      const group = activeObject as any;
      group.toActiveSelection();
      this.canvas.requestRenderAll();
    }
  }

  // Copy/Paste/Duplicate Methods
  copySelected(): void {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length > 0) {
      // Store in service for paste operation
      localStorage.setItem('fabricClipboard', JSON.stringify(selectedObjects.map(obj => obj.toObject())));
    }
  }

  paste(): void {
    const clipboardData = localStorage.getItem('fabricClipboard');
    if (!clipboardData || !this.canvas) return;
    
    const objectData = JSON.parse(clipboardData);
    objectData.forEach((data: any, index: number) => {
      // Offset pasted objects
      data.left += 20;
      data.top += 20;
      
      this.createObjectFromData(data);
    });
  }

  duplicateSelected(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      const data = obj.toObject();
      data.left += 20;
      data.top += 20;
      this.createObjectFromData(data);
    });
  }

  private createObjectFromData(data: any): void {
    if (!this.canvas) return;
    
    let newObject: FabricObject;
    
    switch (data.type) {
      case 'rect':
        newObject = new Rect(data);
        break;
      case 'circle':
        newObject = new Circle(data);
        break;
      case 'text':
      case 'i-text':
      case 'textbox':
        newObject = new FabricText(data.text, data);
        break;
      default:
        return;
    }
    
    this.canvas.add(newObject);
    this.canvas.setActiveObject(newObject);
  }

  // Transform Methods
  flipHorizontal(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.set('flipX', !obj.flipX);
    });
    this.canvas?.requestRenderAll();
  }

  flipVertical(): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.set('flipY', !obj.flipY);
    });
    this.canvas?.requestRenderAll();
  }

  rotateSelected(angle: number): void {
    const selectedObjects = this.getSelectedObjects();
    selectedObjects.forEach(obj => {
      obj.rotate(obj.angle! + angle);
    });
    this.canvas?.requestRenderAll();
  }

  // Delete and Clear Methods
  deleteSelected(): void {
    if (!this.canvas) return;
    
    const activeObjects = this.canvas.getActiveObjects();
    if (activeObjects.length) {
      this.canvas.discardActiveObject();
      activeObjects.forEach((obj: FabricObject) => {
        this.canvas!.remove(obj);
      });
    }
  }

  clearCanvas(): void {
    if (!this.canvas) return;
    this.canvas.clear();
    this.canvas.backgroundColor = 'white';
  }

 setCanvasBackgroundColor(color: string): void {
  if (!this.canvas) return;
  this.canvas.backgroundColor = color;
  this.canvas.requestRenderAll();
}

async setCanvasBackgroundImage(imageUrl: string): Promise<void> {
  if (!this.canvas) return;

  try {
    const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });

    img.scaleToWidth(this.canvas.width!);
    img.scaleToHeight(this.canvas.height!);

    this.canvas.backgroundImage = img;
    this.canvas.requestRenderAll();
  } catch (err) {
    console.error("Error loading background image:", err);
  }
}

// setCanvasBackgroundImage(imageUrl: string): void {
//   if (!this.canvas) return;
  
//   FabricImage.fromURL(imageUrl, (img: FabricImage) => {
//     // Set the background image
//     this.canvas!.setBackgroundImage(img, () => {
//       this.canvas!.requestRenderAll();
//     }, {
//       scaleX: this.canvas!.width! / img.width!,
//       scaleY: this.canvas!.height! / img.height!,
//       // Add crossOrigin if needed for CORS issues
//       crossOrigin: 'anonymous'
//     });
//   }, { crossOrigin: 'anonymous' });
// }

  // Export/Import Methods
  getCanvasData(): any {
    if (!this.canvas) return null;
    return this.canvas.toJSON();
  }

  loadCanvasData(data: any): void {
    if (!this.canvas) return;
    this.canvas.loadFromJSON(data, () => {
      this.canvas!.renderAll();
    });
  }

  exportAsImage(): string {
    if (!this.canvas) return '';
    return this.canvas.toDataURL({
      multiplier: 1,
      format: 'png',
      quality: 1
    });
  }

  // Get object properties for UI
  getSelectedObjectProperties(): any {
    const selectedObjects = this.getSelectedObjects();
    if (selectedObjects.length === 0) return null;
    
    const obj = selectedObjects[0];
    return {
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      opacity: obj.opacity,
      angle: obj.angle,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      flipX: obj.flipX,
      flipY: obj.flipY,
      // Text-specific properties
      ...(obj.type === 'text' && {
        fontFamily: (obj as FabricText).fontFamily,
        fontSize: (obj as FabricText).fontSize,
        fontWeight: (obj as FabricText).fontWeight,
        fontStyle: (obj as FabricText).fontStyle,
        underline: (obj as FabricText).underline,
        linethrough: (obj as FabricText).linethrough,
        textAlign: (obj as FabricText).textAlign,
      }),
      // Shape-specific properties
      ...(obj.type === 'rect' && {
        rx: (obj as Rect).rx,
        ry: (obj as Rect).ry,
      }),
      ...(obj.type === 'circle' && {
        radius: (obj as Circle).radius,
      })
    };
  }

  dispose(): void {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
  }
}