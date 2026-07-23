/**
 * Shape Module — interactive drawing of predefined shapes:
 *   • Circle    — perfect circle (uniform scaling enforced)
 *   • Ellipse   — independent width / height
 *   • Square    — perfect square (uniform scaling enforced)
 *   • Rectangle — independent width / height
 *   • Arrow     — line with arrowhead, endpoints individually editable
 *
 * Behaviour:
 *   1. activate(type) puts the canvas into drag-to-draw mode for that
 *      shape. The user presses-and-drags to size the shape; on mouseup
 *      the shape is finalised, registered as an `_rpAnnotation`, and
 *      selected so resize handles are visible immediately.
 *   2. All shapes are stored as plain Fabric objects so they participate
 *      in undo / redo, JSON serialisation and the standard eraser flow.
 *   3. Circle and Square lock uniform scaling so the user can only resize
 *      them proportionally — they can never be turned into ellipses /
 *      rectangles.
 *   4. The Arrow uses a custom `fabric.Object` subclass with two custom
 *      control handles at the start- and end-points so the user can
 *      drag either tip to reshape the arrow (changing its direction and
 *      length). The whole arrow can still be dragged to reposition.
 *
 * The module does NOT modify anything outside its own state; it only
 * registers / un-registers a few canvas listeners during the active
 * draw-gesture.
 */
import { fabric } from 'fabric';
import { ShapeType } from '../types/index.js';

/* ------------------------------------------------------------------ */
/*  Arrow — custom Fabric object                                      */
/* ------------------------------------------------------------------ */

/**
 * Internal arrow object — extends fabric.Object with two endpoints
 * (x1, y1) and (x2, y2) expressed in **canvas coordinates** (the same
 * coordinate system as `left` / `top`). The bounding box is recomputed
 * from the endpoints on every change.
 */
export interface RpArrow extends fabric.Object {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    arrowheadSize: number;
    _updateBBox(): void;
}

const ARROW_TYPE = 'rpArrow';

/** Lazily registered so we only patch fabric once per page-load */
let arrowClassRegistered = false;

function registerArrowClass(): any {
    if (arrowClassRegistered && (fabric as any).RpArrow) {
        return (fabric as any).RpArrow;
    }

    const RpArrowClass = (fabric as any).util.createClass(fabric.Object, {
        type: ARROW_TYPE,

        initialize(this: any, options: any) {
            options = options || {};
            this.callSuper('initialize', options);
            this.x1 = options.x1 ?? 0;
            this.y1 = options.y1 ?? 0;
            this.x2 = options.x2 ?? 0;
            this.y2 = options.y2 ?? 0;
            this.arrowheadSize = options.arrowheadSize ?? 14;
            this.objectCaching = false;
            this._lastLeft = 0;
            this._lastTop = 0;
            this._updateBBox();
        },

        /**
         * Recompute the axis-aligned bounding box from the endpoints and
         * sync the parent left/top/width/height accordingly. Always called
         * after the endpoints change.
         */
        _updateBBox(this: any) {
            const minX = Math.min(this.x1, this.x2);
            const minY = Math.min(this.y1, this.y2);
            const maxX = Math.max(this.x1, this.x2);
            const maxY = Math.max(this.y1, this.y2);
            // Pad bbox slightly so the arrowhead never gets clipped from hit-testing
            const pad = (this.strokeWidth || 2) + (this.arrowheadSize || 14);
            this.set({
                left: minX - pad,
                top: minY - pad,
                width: Math.max(maxX - minX + pad * 2, 1),
                height: Math.max(maxY - minY + pad * 2, 1),
                scaleX: 1,
                scaleY: 1,
                angle: 0,
            });
            this._lastLeft = this.left;
            this._lastTop = this.top;
            this.setCoords();
        },

        /**
         * Render the arrow inside Fabric's translated/centred context.
         * Fabric translates the ctx so (0,0) is the object's centre, hence
         * we convert canvas-space endpoints into local-space relative to
         * the bbox centre.
         */
        _render(this: any, ctx: CanvasRenderingContext2D) {
            const cx = (this.x1 + this.x2) / 2;
            const cy = (this.y1 + this.y2) / 2;

            const sx = this.x1 - cx;
            const sy = this.y1 - cy;
            const ex = this.x2 - cx;
            const ey = this.y2 - cy;

            const dx = ex - sx;
            const dy = ey - sy;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.5) return;

            const angle = Math.atan2(dy, dx);
            const stroke = this.stroke || '#ff0000';
            const sw = this.strokeWidth || 3;
            const headLen = Math.max(this.arrowheadSize || 14, sw * 3);
            const headHalfW = headLen * 0.55;

            // Stop the shaft short so it meets the arrowhead's BASE, not its tip
            const baseX = ex - Math.cos(angle) * headLen;
            const baseY = ey - Math.sin(angle) * headLen;

            ctx.save();
            ctx.lineWidth = sw;
            ctx.strokeStyle = stroke;
            ctx.fillStyle = stroke;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Shaft
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(baseX, baseY);
            ctx.stroke();

            // Arrowhead — isoceles triangle whose tip is at (ex, ey)
            const perpX = -Math.sin(angle);
            const perpY = Math.cos(angle);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(baseX + perpX * headHalfW, baseY + perpY * headHalfW);
            ctx.lineTo(baseX - perpX * headHalfW, baseY - perpY * headHalfW);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        },

        /** Serialise the endpoints so undo / redo can reproduce the arrow */
        toObject(this: any, propertiesToInclude?: string[]) {
            return this.callSuper(
                'toObject',
                ['x1', 'y1', 'x2', 'y2', 'arrowheadSize', '_rpAnnotation', '_rpType', '_rpShapeType']
                    .concat(propertiesToInclude || []),
            );
        },
    });

    // Re-hydrate from JSON (used by the history module on undo/redo)
    RpArrowClass.fromObject = function (object: any, callback: any) {
        const arrow = new RpArrowClass(object);
        if (callback) callback(arrow);
        return arrow;
    };
    RpArrowClass.async = false;

    (fabric as any).RpArrow = RpArrowClass;
    arrowClassRegistered = true;
    return RpArrowClass;
}

/* ------------------------------------------------------------------ */
/*  Endpoint controls for the arrow                                   */
/* ------------------------------------------------------------------ */

/**
 * Render a small circular handle at (left, top) — matches the visual
 * style of the standard corner handles already used elsewhere in the
 * editor.
 */
function renderEndpointHandle(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
): void {
    const r = 6;
    ctx.save();
    ctx.fillStyle = '#0ea5e9';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left, top, r, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/**
 * Build the two custom endpoint controls and attach them to the arrow
 * instance (Fabric supports per-instance `controls` in v5+).
 */
function attachArrowEndpointControls(arrow: any): void {
    const startControl = new (fabric as any).Control({
        x: 0,
        y: 0,
        cursorStyleHandler: () => 'crosshair',
        actionName: 'arrowStart',
        positionHandler(_dim: any, _finalMatrix: any, fabricObject: any) {
            return new fabric.Point(fabricObject.x1, fabricObject.y1);
        },
        actionHandler(_eventData: any, transform: any, x: number, y: number) {
            const t = transform.target as any;
            t.x1 = x;
            t.y1 = y;
            t._updateBBox();
            t.canvas?.requestRenderAll();
            return true;
        },
        render(ctx: CanvasRenderingContext2D, left: number, top: number) {
            renderEndpointHandle(ctx, left, top);
        },
    });

    const endControl = new (fabric as any).Control({
        x: 0,
        y: 0,
        cursorStyleHandler: () => 'crosshair',
        actionName: 'arrowEnd',
        positionHandler(_dim: any, _finalMatrix: any, fabricObject: any) {
            return new fabric.Point(fabricObject.x2, fabricObject.y2);
        },
        actionHandler(_eventData: any, transform: any, x: number, y: number) {
            const t = transform.target as any;
            t.x2 = x;
            t.y2 = y;
            t._updateBBox();
            t.canvas?.requestRenderAll();
            return true;
        },
        render(ctx: CanvasRenderingContext2D, left: number, top: number) {
            renderEndpointHandle(ctx, left, top);
        },
    });

    // Only show our two custom endpoint handles — hide all default ones
    arrow.controls = {
        arrowStart: startControl,
        arrowEnd: endControl,
    };
}

/* ------------------------------------------------------------------ */
/*  Polyline — custom Fabric object (free-form line-path)             */
/* ------------------------------------------------------------------ */

/**
 * Internal polyline object — a chain of `points` expressed in **canvas
 * coordinates**. The user builds it up with successive clicks, and once
 * finalised each vertex is individually draggable via a custom control.
 */
export interface RpPolyline extends fabric.Object {
    points: { x: number; y: number }[];
    _updateBBox(): void;
}

const POLYLINE_TYPE = 'rpPolyline';

let polylineClassRegistered = false;

function registerPolylineClass(): any {
    if (polylineClassRegistered && (fabric as any).RpPolyline) {
        return (fabric as any).RpPolyline;
    }

    const RpPolylineClass = (fabric as any).util.createClass(fabric.Object, {
        type: POLYLINE_TYPE,

        initialize(this: any, options: any) {
            options = options || {};
            this.callSuper('initialize', options);
            this.points = (options.points || []).map((p: any) => ({ x: p.x, y: p.y }));
            this.objectCaching = false;
            this._lastLeft = 0;
            this._lastTop = 0;
            this._updateBBox();
        },

        /**
         * Recompute the axis-aligned bounding box from the vertex list and
         * sync the parent left/top/width/height accordingly.
         */
        _updateBBox(this: any) {
            if (!this.points || this.points.length === 0) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of this.points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            const pad = (this.strokeWidth || 2) + 4;
            this.set({
                left: minX - pad,
                top: minY - pad,
                width: Math.max(maxX - minX + pad * 2, 1),
                height: Math.max(maxY - minY + pad * 2, 1),
                scaleX: 1,
                scaleY: 1,
                angle: 0,
            });
            this._lastLeft = this.left;
            this._lastTop = this.top;
            this.setCoords();
        },

        /**
         * Render the polyline in the object's local (centred) coord system.
         * Fabric translates the ctx so (0,0) is the object's centre.
         */
        _render(this: any, ctx: CanvasRenderingContext2D) {
            if (!this.points || this.points.length < 2) return;

            // Compute centre in canvas coords so we can offset each vertex
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of this.points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            const stroke = this.stroke || '#ff0000';
            const sw = this.strokeWidth || 3;

            ctx.save();
            ctx.lineWidth = sw;
            ctx.strokeStyle = stroke;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(this.points[0].x - cx, this.points[0].y - cy);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x - cx, this.points[i].y - cy);
            }
            ctx.stroke();

            // While the polyline is still being built (before finalisation),
            // draw small dots at every committed vertex so the user can see
            // their click points. The very last point in `points` is the
            // cursor-tracking vertex, so we skip it.
            //
            // Once ≥ 3 real vertices exist, the first vertex is drawn a bit
            // larger and highlighted to signal "click me to close the shape".
            if ((this as any)._rpBuilding) {
                const committed = this.points.length - 1; // skip trailing tracking pt
                const dotR = 4;
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#ffffff';
                for (let i = 0; i < committed; i++) {
                    const isFirst = i === 0;
                    const isCloseTarget = isFirst && committed >= 3;
                    const r = isCloseTarget ? dotR + 2 : dotR;
                    ctx.beginPath();
                    ctx.arc(this.points[i].x - cx, this.points[i].y - cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = isCloseTarget ? '#0ea5e9' : '#ffffff';
                    ctx.fill();
                    ctx.stroke();
                }
            }
            ctx.restore();
        },

        /** Serialise the vertex list so undo / redo can reproduce the polyline */
        toObject(this: any, propertiesToInclude?: string[]) {
            const base = this.callSuper(
                'toObject',
                ['_rpAnnotation', '_rpType', '_rpShapeType'].concat(propertiesToInclude || []),
            );
            base.points = (this.points || []).map((p: any) => ({ x: p.x, y: p.y }));
            return base;
        },
    });

    RpPolylineClass.fromObject = function (object: any, callback: any) {
        const poly = new RpPolylineClass(object);
        if (callback) callback(poly);
        return poly;
    };
    RpPolylineClass.async = false;

    (fabric as any).RpPolyline = RpPolylineClass;
    polylineClassRegistered = true;
    return RpPolylineClass;
}

/**
 * Build one draggable Control per vertex and attach them to the polyline
 * instance. Called after the shape is finalised, and re-called after
 * JSON re-hydration (undo / redo).
 */
function attachPolylineVertexControls(poly: any): void {
    const controls: Record<string, any> = {};
    const count = (poly.points || []).length;
    for (let i = 0; i < count; i++) {
        const idx = i;
        controls[`v${idx}`] = new (fabric as any).Control({
            x: 0,
            y: 0,
            cursorStyleHandler: () => 'crosshair',
            actionName: `polyVertex${idx}`,
            positionHandler(_dim: any, _finalMatrix: any, fabricObject: any) {
                const p = fabricObject.points[idx];
                return new fabric.Point(p.x, p.y);
            },
            actionHandler(_eventData: any, transform: any, x: number, y: number) {
                const t = transform.target as any;
                if (!t.points[idx]) return false;
                t.points[idx].x = x;
                t.points[idx].y = y;
                t._updateBBox();
                t.canvas?.requestRenderAll();
                return true;
            },
            render(ctx: CanvasRenderingContext2D, left: number, top: number) {
                renderEndpointHandle(ctx, left, top);
            },
        });
    }
    poly.controls = controls;
}

/* ------------------------------------------------------------------ */
/*  ShapeModule                                                       */
/* ------------------------------------------------------------------ */

export class ShapeModule {
    private canvas: fabric.Canvas;
    private isActive = false;
    private activeShape: ShapeType | null = null;
    private strokeColor: string = '#ff0000';
    private strokeWidth: number = 3;

    // Drag-to-draw state
    private isDrawing = false;
    private startX = 0;
    private startY = 0;
    private currentObject: fabric.Object | null = null;

    constructor(canvas: fabric.Canvas) {
        this.canvas = canvas;
        registerArrowClass();
        registerPolylineClass();
        // When an arrow or polyline is added to the canvas (including after
        // undo/redo restores from JSON) we need to re-attach its custom
        // controls and drag-sync handler, because plain JSON deserialisation
        // can't reconstruct functions.
        this.canvas.on('object:added', (e: fabric.IEvent) => {
            const obj = e.target as any;
            if (obj && obj.type === ARROW_TYPE && !obj._rpArrowBound) {
                attachArrowEndpointControls(obj);
                this.wireArrowDragSync(obj);
                obj._rpArrowBound = true;
            }
            if (obj && obj.type === POLYLINE_TYPE && !obj._rpPolyBound) {
                attachPolylineVertexControls(obj);
                this.wirePolylineDragSync(obj);
                obj._rpPolyBound = true;
            }
        });
    }

    /* ============================ public API ============================ */

    /**
     * Activate drag-to-draw for the requested primitive.
     * Replaces any currently-active shape tool.
     */
    activate(shape: ShapeType): void {
        this.deactivate();
        this.isActive = true;
        this.activeShape = shape;

        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        this.canvas.hoverCursor = 'crosshair';

        // Make existing shape annotations selectable when we're not mid-draw,
        // so the user can grab a previously drawn shape to resize it. We
        // don't disturb other annotation types.
        this.canvas.getObjects().forEach((obj: any) => {
            if (obj._rpShapeType) {
                obj.selectable = true;
                obj.evented = true;
            }
        });

        this.canvas.on('mouse:down', this.handleMouseDown);
        this.canvas.on('mouse:move', this.handleMouseMove);
        this.canvas.on('mouse:up', this.handleMouseUp);

        // Polyline uses click-to-add + dblclick/keyboard-to-finish, so we
        // additionally listen for double-click on the canvas and for the
        // Enter/Escape keys on the document.
        if (shape === 'polyline') {
            this.canvas.on('mouse:dblclick', this.handleDblClick);
            document.addEventListener('keydown', this.handleKeyDown);
        }
    }

    deactivate(): void {
        if (!this.isActive && !this.isDrawing) return;
        this.canvas.off('mouse:down', this.handleMouseDown);
        this.canvas.off('mouse:move', this.handleMouseMove);
        this.canvas.off('mouse:up', this.handleMouseUp);
        this.canvas.off('mouse:dblclick', this.handleDblClick as any);
        document.removeEventListener('keydown', this.handleKeyDown);
        // If we were mid-polyline, abandon it (its trailing tracking point
        // would otherwise leave an orphan segment on the canvas).
        if (this.currentObject && (this.currentObject as any)._rpShapeType === 'polyline') {
            this.canvas.remove(this.currentObject);
        }
        this.canvas.defaultCursor = 'default';
        this.canvas.hoverCursor = 'move';
        this.isActive = false;
        this.activeShape = null;
        this.isDrawing = false;
        this.currentObject = null;
    }

    /** Set stroke colour for shapes drawn from this point onward. Also
     *  updates the currently-selected shape (if any) so it matches the
     *  global color-picker behaviour used by draw/text/callout. */
    setStrokeColor(color: string): void {
        this.strokeColor = color;
        const active = this.canvas.getActiveObject() as any;
        if (active && active._rpShapeType) {
            if (active._rpShapeType === 'arrow' || active._rpShapeType === 'polyline') {
                // Line-only shapes: only stroke matters
                active.set({ stroke: color });
            } else {
                // Filled vs outlined: keep stroke + matching translucent fill for
                // closed shapes so they remain visible against any background.
                active.set({ stroke: color, fill: 'transparent' });
            }
            this.canvas.requestRenderAll();
        }
        // Also update the polyline currently being built (before finalise),
        // so the user sees live colour feedback while clicking points.
        if (this.currentObject && (this.currentObject as any)._rpShapeType === 'polyline') {
            (this.currentObject as any).set({ stroke: color });
            this.canvas.requestRenderAll();
        }
    }

    setStrokeWidth(width: number): void {
        this.strokeWidth = Math.max(1, Math.min(50, width));
        const active = this.canvas.getActiveObject() as any;
        if (active && active._rpShapeType) {
            active.set({ strokeWidth: this.strokeWidth });
            if (active._rpShapeType === 'arrow' || active._rpShapeType === 'polyline') {
                active._updateBBox?.();
            }
            this.canvas.requestRenderAll();
        }
        if (this.currentObject && (this.currentObject as any)._rpShapeType === 'polyline') {
            (this.currentObject as any).set({ strokeWidth: this.strokeWidth });
            (this.currentObject as any)._updateBBox?.();
            this.canvas.requestRenderAll();
        }
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    /* ============================ draw gesture ========================== */

    private handleMouseDown = (opt: fabric.IEvent): void => {
        if (!this.isActive || !this.activeShape) return;
        // If the user clicked an existing shape annotation, let Fabric select
        // it instead of starting a new draw gesture
        if (opt.target && (opt.target as any)._rpShapeType) return;

        const pointer = this.canvas.getPointer(opt.e);

        // Polyline: click-to-add-vertex flow.
        if (this.activeShape === 'polyline') {
            // The 2nd click of a native dblclick has detail === 2; skip
            // appending in that case — the dblclick handler will finalise.
            const detail = (opt.e as MouseEvent)?.detail;
            if (detail && detail >= 2) return;

            if (!this.currentObject) {
                // Start a new polyline with two coincident points; the second
                // acts as a "tracking" vertex that follows the cursor until
                // the next click commits it.
                this.currentObject = this.createShape('polyline', pointer.x, pointer.y);
                if (this.currentObject) {
                    this.canvas.add(this.currentObject);
                    this.isDrawing = true;
                    this.canvas.requestRenderAll();
                }
            } else {
                const poly = this.currentObject as any;
                // If the user clicks on (or very near) the first vertex and
                // we already have ≥ 3 real vertices, close the shape and
                // finalise instead of appending a new vertex.
                if (this.isNearFirstVertex(poly, pointer.x, pointer.y)) {
                    this.finalisePolyline(true);
                    return;
                }
                // Otherwise commit the current tracking point (already at the
                // cursor from handleMouseMove) and append a new tracking point.
                poly.points.push({ x: pointer.x, y: pointer.y });
                poly._updateBBox();
                this.canvas.requestRenderAll();
            }
            return;
        }

        // Drag-to-draw for all other shape types
        this.isDrawing = true;
        this.startX = pointer.x;
        this.startY = pointer.y;
        this.currentObject = this.createShape(this.activeShape, pointer.x, pointer.y);
        if (this.currentObject) {
            this.canvas.add(this.currentObject);
            this.canvas.requestRenderAll();
        }
    };

    private handleMouseMove = (opt: fabric.IEvent): void => {
        if (!this.isDrawing || !this.currentObject || !this.activeShape) return;
        const pointer = this.canvas.getPointer(opt.e);

        if (this.activeShape === 'polyline') {
            // Update the trailing (tracking) vertex to follow the cursor.
            // If the cursor is near the first vertex (and enough real points
            // exist to close), snap the tracking vertex exactly onto it so
            // the user sees the closure preview.
            const poly = this.currentObject as any;
            if (poly.points.length > 0) {
                const last = poly.points[poly.points.length - 1];
                if (this.isNearFirstVertex(poly, pointer.x, pointer.y)) {
                    last.x = poly.points[0].x;
                    last.y = poly.points[0].y;
                } else {
                    last.x = pointer.x;
                    last.y = pointer.y;
                }
                poly._updateBBox();
                this.canvas.requestRenderAll();
            }
            return;
        }

        this.updateShapeDuringDraw(this.activeShape, pointer.x, pointer.y);
        this.canvas.requestRenderAll();
    };

    private handleMouseUp = (): void => {
        // Polyline drawing is not gesture-based — mouse-up does nothing;
        // finalisation happens on dblclick, Enter or Escape.
        if (this.activeShape === 'polyline') return;

        if (!this.isDrawing || !this.currentObject) return;
        const obj = this.currentObject as any;

        // Reject zero-sized "click-without-drag" shapes
        const tooSmall = this.isShapeTooSmall(obj);
        this.isDrawing = false;

        if (tooSmall) {
            this.canvas.remove(obj);
            this.currentObject = null;
            this.canvas.requestRenderAll();
            return;
        }

        // Finalise: enable controls + select so resize handles appear right away
        obj.selectable = true;
        obj.evented = true;
        this.canvas.setActiveObject(obj);
        this.canvas.requestRenderAll();
        // Fire a synthetic object:modified so the editor saves an undo entry.
        this.canvas.fire('object:modified', { target: obj });
        this.currentObject = null;
    };

    /** Double-click while drawing a polyline → finalise it. */
    private handleDblClick = (_opt: fabric.IEvent): void => {
        if (this.activeShape !== 'polyline') return;
        this.finalisePolyline();
    };

    /** Enter → finalise; Escape → cancel — only while building a polyline. */
    private handleKeyDown = (e: KeyboardEvent): void => {
        if (this.activeShape !== 'polyline' || !this.isDrawing || !this.currentObject) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            this.finalisePolyline();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelPolyline();
        }
    };

    private finalisePolyline(closed: boolean = false): void {
        if (!this.currentObject) return;
        const poly = this.currentObject as any;

        if (closed) {
            // Snap the trailing tracking vertex exactly onto the first vertex
            // so the last drawn segment cleanly closes the shape.
            if (poly.points.length >= 2) {
                poly.points[poly.points.length - 1] = {
                    x: poly.points[0].x,
                    y: poly.points[0].y,
                };
            }
        } else {
            // Drop the trailing tracking vertex — it just follows the cursor
            if (poly.points.length > 0) poly.points.pop();
        }

        this.isDrawing = false;

        if (this.isShapeTooSmall(poly)) {
            this.canvas.remove(poly);
            this.currentObject = null;
            this.canvas.requestRenderAll();
            return;
        }

        poly._rpBuilding = false;
        poly._updateBBox();
        attachPolylineVertexControls(poly);
        poly.hasControls = true;
        poly.selectable = true;
        poly.evented = true;
        poly._rpPolyBound = true;
        this.canvas.setActiveObject(poly);
        this.canvas.requestRenderAll();
        this.canvas.fire('object:modified', { target: poly });
        this.currentObject = null;
    }

    /**
     * Is the given pointer close enough to the polyline's first vertex to
     * count as a "close-shape" click? Only true once we have ≥ 3 committed
     * vertices (i.e. points.length ≥ 4, counting the trailing tracker).
     * Threshold is 12 screen pixels regardless of zoom.
     */
    private isNearFirstVertex(poly: any, x: number, y: number): boolean {
        if (!poly.points || poly.points.length < 4) return false;
        const first = poly.points[0];
        const dx = x - first.x;
        const dy = y - first.y;
        const zoom = this.canvas.getZoom() || 1;
        const threshold = 12 / zoom;
        return dx * dx + dy * dy <= threshold * threshold;
    }

    private cancelPolyline(): void {
        if (!this.currentObject) return;
        this.canvas.remove(this.currentObject);
        this.currentObject = null;
        this.isDrawing = false;
        this.canvas.requestRenderAll();
    }

    /**
     * Keep a polyline's vertices in sync with its left/top as the user drags
     * the whole shape. Mirrors `wireArrowDragSync`.
     */
    private wirePolylineDragSync(poly: any): void {
        poly.on('moving', () => {
            const dx = (poly.left ?? 0) - (poly._lastLeft ?? 0);
            const dy = (poly.top ?? 0) - (poly._lastTop ?? 0);
            if (dx === 0 && dy === 0) return;
            for (const p of poly.points) {
                p.x += dx;
                p.y += dy;
            }
            poly._lastLeft = poly.left;
            poly._lastTop = poly.top;
        });
        poly.on('modified', () => {
            poly._lastLeft = poly.left;
            poly._lastTop = poly.top;
        });
    }

    /* ============================ factory =============================== */

    private createShape(type: ShapeType, x: number, y: number): fabric.Object | null {
        const common = {
            left: x,
            top: y,
            originX: 'left' as const,
            originY: 'top' as const,
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            strokeUniform: true,
            fill: 'transparent',
            selectable: false, // becomes true on mouse:up
            evented: false,
            hasControls: true,
            hasBorders: true,
            cornerColor: '#0ea5e9',
            cornerStyle: 'circle' as const,
            cornerSize: 10,
            transparentCorners: false,
            borderColor: '#0ea5e9',
            lockRotation: true,
            hasRotatingPoint: false,
            objectCaching: false,
        };

        let obj: fabric.Object | null = null;

        if (type === 'circle') {
            const c = new fabric.Circle({
                ...common,
                radius: 1,
                lockUniScaling: true,
            });
            // Only show corner handles — side handles would imply non-uniform scaling
            c.setControlsVisibility({
                mt: false, mb: false, ml: false, mr: false, mtr: false,
            });
            obj = c;
        } else if (type === 'ellipse') {
            obj = new fabric.Ellipse({
                ...common,
                rx: 1,
                ry: 1,
            });
        } else if (type === 'square') {
            const r = new fabric.Rect({
                ...common,
                width: 1,
                height: 1,
                lockUniScaling: true,
            });
            r.setControlsVisibility({
                mt: false, mb: false, ml: false, mr: false, mtr: false,
            });
            obj = r;
        } else if (type === 'rectangle') {
            // Free-aspect rectangle — keeps all side handles so width and
            // height can be resized independently.
            obj = new fabric.Rect({
                ...common,
                width: 1,
                height: 1,
            });
        } else if (type === 'arrow') {
            const ArrowClass = registerArrowClass();
            const arrow = new ArrowClass({
                x1: x,
                y1: y,
                x2: x,
                y2: y,
                stroke: this.strokeColor,
                strokeWidth: this.strokeWidth,
                fill: this.strokeColor,
                selectable: false,
                evented: false,
                hasControls: true,
                hasBorders: false,
                lockRotation: true,
                hasRotatingPoint: false,
                objectCaching: false,
            });
            attachArrowEndpointControls(arrow);
            this.wireArrowDragSync(arrow);
            (arrow as any)._rpArrowBound = true;
            obj = arrow as fabric.Object;
        } else if (type === 'polyline') {
            // Custom line-path — starts with two coincident points (the second
            // acts as the cursor-tracking vertex until the next click commits it).
            const PolyClass = registerPolylineClass();
            const poly = new PolyClass({
                points: [{ x, y }, { x, y }],
                stroke: this.strokeColor,
                strokeWidth: this.strokeWidth,
                fill: '',
                selectable: false,
                evented: false,
                hasControls: false, // no controls while being built
                hasBorders: false,
                lockRotation: true,
                hasRotatingPoint: false,
                objectCaching: false,
            });
            (poly as any)._rpBuilding = true;
            this.wirePolylineDragSync(poly);
            (poly as any)._rpPolyBound = true;
            obj = poly as fabric.Object;
        }

        if (obj) {
            (obj as any)._rpAnnotation = true;
            (obj as any)._rpType = 'shape';
            (obj as any)._rpShapeType = type;
        }
        return obj;
    }

    /**
     * Keep an arrow's endpoints in sync with its left/top as the user
     * drags the whole arrow. Fabric updates `left`/`top` during the
     * `moving` event but the arrow stores its endpoints in canvas coords,
     * so we shift them by the per-frame delta.
     */
    private wireArrowDragSync(arrow: any): void {
        arrow.on('moving', () => {
            const dx = (arrow.left ?? 0) - (arrow._lastLeft ?? 0);
            const dy = (arrow.top ?? 0) - (arrow._lastTop ?? 0);
            if (dx === 0 && dy === 0) return;
            arrow.x1 += dx;
            arrow.x2 += dx;
            arrow.y1 += dy;
            arrow.y2 += dy;
            arrow._lastLeft = arrow.left;
            arrow._lastTop = arrow.top;
            // Don't call _updateBBox here — left/top are already correct,
            // the user is mid-drag and we don't want to fight Fabric.
        });
        arrow.on('modified', () => {
            arrow._lastLeft = arrow.left;
            arrow._lastTop = arrow.top;
        });
    }

    /* ============================ sizing during draw ==================== */

    private updateShapeDuringDraw(type: ShapeType, x: number, y: number): void {
        if (!this.currentObject) return;
        const obj = this.currentObject as any;

        const dx = x - this.startX;
        const dy = y - this.startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (type === 'circle') {
            // Constrain to a perfect circle — radius is the larger half-diagonal
            const size = Math.max(absDx, absDy);
            const radius = size / 2;
            obj.set({
                left: dx >= 0 ? this.startX : this.startX - size,
                top: dy >= 0 ? this.startY : this.startY - size,
                radius,
            });
        } else if (type === 'ellipse') {
            obj.set({
                left: dx >= 0 ? this.startX : x,
                top: dy >= 0 ? this.startY : y,
                rx: absDx / 2,
                ry: absDy / 2,
            });
        } else if (type === 'square') {
            const size = Math.max(absDx, absDy);
            obj.set({
                left: dx >= 0 ? this.startX : this.startX - size,
                top: dy >= 0 ? this.startY : this.startY - size,
                width: size,
                height: size,
            });
        } else if (type === 'rectangle') {
            obj.set({
                left: dx >= 0 ? this.startX : x,
                top: dy >= 0 ? this.startY : y,
                width: absDx,
                height: absDy,
            });
        } else if (type === 'arrow') {
            obj.x2 = x;
            obj.y2 = y;
            obj._updateBBox();
        }
        obj.setCoords();
    }

    private isShapeTooSmall(obj: any): boolean {
        const minSize = 4;
        if (obj.type === 'circle') return (obj.radius || 0) < minSize / 2;
        if (obj.type === 'ellipse') return (obj.rx || 0) < minSize / 2 || (obj.ry || 0) < minSize / 2;
        if (obj.type === 'rect') return (obj.width || 0) < minSize || (obj.height || 0) < minSize;
        if (obj.type === ARROW_TYPE) {
            const dx = obj.x2 - obj.x1;
            const dy = obj.y2 - obj.y1;
            return Math.sqrt(dx * dx + dy * dy) < minSize;
        }
        if (obj.type === POLYLINE_TYPE) {
            // Reject polylines with fewer than 2 real vertices or a
            // near-zero total path length.
            const pts = obj.points || [];
            if (pts.length < 2) return true;
            let total = 0;
            for (let i = 1; i < pts.length; i++) {
                const dx = pts[i].x - pts[i - 1].x;
                const dy = pts[i].y - pts[i - 1].y;
                total += Math.sqrt(dx * dx + dy * dy);
            }
            return total < minSize;
        }
        return false;
    }
}
