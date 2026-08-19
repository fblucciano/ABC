/**
 * VenusP Valve Viewer — landmarks, technical mesh, MPA segment phase model, canvas drag
 */
(function (global) {
    'use strict';

    var SEG_A_SYSTOLE = -0.035;
    var SEG_A_DIASTOLE = 0.035;
    var SEG_B_SYSTOLE = 0.045;
    var SEG_B_DIASTOLE = -0.045;
    var ST_JUNCTION_MM = 10;
    var FLARE_IN_MM = 12;
    var FLARE_OUT_MM = 17;

    global.valveViewerState = {
        landmark: 'valvar',
        offsetMm: 0,
        canvasScale: 1
    };

    var dragState = { active: false, startY: 0, startOffset: 0 };

    function vEl(id) { var e = document.getElementById(id); return e ? e.value : ''; }

    function readViewerStateFromUI() {
        global.valveViewerState.landmark = vEl('in-landmark') || 'valvar';
        global.valveViewerState.offsetMm = parseFloat(vEl('in-valve-offset')) || 0;
        var lbl = document.getElementById('valve-offset-label');
        if (lbl) {
            lbl.textContent = (global.valveViewerState.offsetMm > 0 ? '+' : '') +
                global.valveViewerState.offsetMm.toFixed(1) + ' mm';
        }
    }

    function setOffsetMm(mm) {
        mm = Math.max(-20, Math.min(20, mm));
        global.valveViewerState.offsetMm = mm;
        var off = document.getElementById('in-valve-offset');
        if (off) off.value = String(mm);
        readViewerStateFromUI();
        if (typeof global.drawRVOTCanvas === 'function') global.drawRVOTCanvas();
    }

    function formatPlaneDisplayName(p) {
        if (!p) return '—';
        return String(p.name || 'Plane').replace(/\s*\*$/, '').trim() || 'Plane';
    }

    global.getPlaneNameAtDist = function (tablePlanes, distMm) {
        if (!tablePlanes || !tablePlanes.length) return '—';
        var best = tablePlanes[0];
        var bestDiff = Math.abs(tablePlanes[0].dist - distMm);
        for (var i = 1; i < tablePlanes.length; i++) {
            var diff = Math.abs(tablePlanes[i].dist - distMm);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = tablePlanes[i];
            }
        }
        return formatPlaneDisplayName(best);
    };

    global.syncLandmarkSelectFromPlanes = function (tablePlanes) {
        var sel = document.getElementById('in-landmark');
        if (!sel || !tablePlanes || !tablePlanes.length) return;
        var prev = sel.value;
        var userSet = sel.dataset.userSet === '1';
        var sorted = tablePlanes.slice().sort(function (a, b) { return a.dist - b.dist; });
        sel.innerHTML = '';
        for (var i = 0; i < sorted.length; i++) {
            var p = sorted[i];
            var opt = document.createElement('option');
            opt.value = p.id;
            var label = formatPlaneDisplayName(p);
            if (p.dist !== 0) label += ' (' + (p.dist > 0 ? '+' : '') + p.dist + ' mm)';
            opt.textContent = label;
            sel.appendChild(opt);
        }
        if (prev && sorted.some(function (p) { return p.id === prev; })) {
            sel.value = prev;
        } else {
            var valvar = sorted.find(function (p) { return p.id === 'valvar'; });
            sel.value = valvar ? valvar.id : sorted[0].id;
        }
        global.valveViewerState.landmark = sel.value;
        if (!userSet && global._pendingMorphLandmark) {
            global.syncLandmarkSuggestion(global._pendingMorphLandmark, tablePlanes);
        }
    };

    function suggestLandmarkFromMorph(morphKey, tablePlanes) {
        if (!tablePlanes || !tablePlanes.length) return null;
        if (morphKey === 'type1') {
            for (var i = 0; i < tablePlanes.length; i++) {
                if ((tablePlanes[i].name || '').toLowerCase().indexOf('bifur') !== -1) return tablePlanes[i].id;
            }
            var top = tablePlanes.slice().sort(function (a, b) { return b.dist - a.dist; })[0];
            return top ? top.id : null;
        }
        var valvar = tablePlanes.find(function (p) { return p.id === 'valvar'; });
        return valvar ? valvar.id : tablePlanes[0].id;
    }

    global.syncLandmarkSuggestion = function (morphKey, tablePlanes) {
        global._pendingMorphLandmark = morphKey;
        var sel = document.getElementById('in-landmark');
        if (!sel || sel.dataset.userSet === '1') return;
        if (!tablePlanes || !tablePlanes.length) return;
        var suggested = suggestLandmarkFromMorph(morphKey, tablePlanes);
        if (suggested) {
            sel.value = suggested;
            global.valveViewerState.landmark = suggested;
        }
    };

    function getStJunctionDist(planes) {
        for (var i = 0; i < planes.length; i++) {
            var n = (planes[i].name || '').toLowerCase();
            if (n.indexOf('mid') !== -1 || n.indexOf('st') !== -1) return planes[i].dist;
        }
        return ST_JUNCTION_MM;
    }

    function getBifurcationDist(planes) {
        var max = 30;
        for (var i = 0; i < planes.length; i++) {
            var n = (planes[i].name || '').toLowerCase();
            if (n.indexOf('bifur') !== -1) return planes[i].dist;
            if (planes[i].dist > max) max = planes[i].dist;
        }
        return max;
    }

    function getPhaseAdjustedDist(dist, phase, stJ, bifDist) {
        if (dist <= stJ) {
            var f = phase === 'systole' ? SEG_A_SYSTOLE : SEG_A_DIASTOLE;
            return dist * (1 + f);
        }
        if (dist <= bifDist) {
            var g = phase === 'systole' ? SEG_B_SYSTOLE : SEG_B_DIASTOLE;
            return dist * (1 + g);
        }
        return dist;
    }

    global.getPhaseAdjustedPlaneGeometry = function (tablePlanes, phase, scale, baseY) {
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        var yLevels = [];
        var radii = [];
        for (var i = 0; i < tablePlanes.length; i++) {
            var p = tablePlanes[i];
            var adjDist = getPhaseAdjustedDist(p.dist, phase, stJ, bif);
            yLevels.push(baseY - (adjDist * scale));
            var pref = phase === 'systole' ? 's' : 'd';
            radii.push(((p[pref + '1'] + p[pref + '2']) / 2 * scale) / 2);
        }
        return { yLevels: yLevels, radii: radii, stJ: stJ, bif: bif };
    };

    global.getLandmarkAnchorDist = function (tablePlanes, landmark) {
        if (!tablePlanes || !tablePlanes.length) return 0;
        for (var i = 0; i < tablePlanes.length; i++) {
            if (tablePlanes[i].id === landmark) return tablePlanes[i].dist;
        }
        var idxValvar = tablePlanes.findIndex(function (p) { return p.id === 'valvar'; });
        var valvarDist = idxValvar >= 0 ? tablePlanes[idxValvar].dist : 0;
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        switch (landmark) {
            case 'supra_annular':
            case 'trans_annular':
                return valvarDist;
            case 'st_junction': return stJ;
            case 'bifurcation': return bif;
            case 'annulus':
            default: return valvarDist;
        }
    };

    /** landmarkY = vertical center of the straight stent cylinder (waist midline) */
    global.computeValveVerticalLayout = function (landmarkCenterY, scale, straightOD, stentLenVal, totalLenDrawing) {
        var pxStentLen = stentLenVal * scale;
        var pxFlareIn = FLARE_IN_MM * scale;
        var pxFlareOut = FLARE_OUT_MM * scale;
        var radStraight = (straightOD * scale) / 2;
        var radFlare = ((straightOD + 10) * scale) / 2;
        var yCenter = landmarkCenterY;
        var yStraightTop = yCenter - (pxStentLen / 2);
        var yStraightBottom = yCenter + (pxStentLen / 2);
        var yOutflowTop = yStraightTop - pxFlareOut;
        var yInflowBottom = yStraightBottom + pxFlareIn;
        return {
            yCenter: yCenter,
            yOutflowTop: yOutflowTop,
            yStraightTop: yStraightTop,
            yStraightBottom: yStraightBottom,
            yInflowBottom: yInflowBottom,
            radStraight: radStraight,
            radFlare: radFlare,
            pxFlareIn: pxFlareIn,
            pxFlareOut: pxFlareOut,
            pxStentLen: pxStentLen,
            totalLenDrawing: totalLenDrawing
        };
    };

    var LENGTH_E_MAP = {
        'P24-20': 48, 'P24-25': 53, 'P26-20': 50, 'P26-25': 55, 'P28-20': 52, 'P28-25': 53, 'P28-30': 60,
        'P30-20': 54, 'P30-25': 54, 'P30-30': 60, 'P32-25': 58, 'P32-30': 65, 'P34-20': 60, 'P34-25': 62,
        'P34-30': 67, 'P36-25': 63, 'P36-30': 67
    };

    global.parseValveSku = function (sku) {
        sku = String(sku || 'P28-25').trim();
        var straightOD = parseInt(sku.split('-')[0].replace('P', ''), 10) || 28;
        var stentLen = parseInt(sku.split('-')[1], 10) || 25;
        var totalLen = LENGTH_E_MAP[sku] || (stentLen + 28);
        return { sku: sku, straightOD: straightOD, stentLen: stentLen, flareOD: straightOD + 10, totalLen: totalLen };
    };

    function valveRadiusAtY(y, layout) {
        var rs = layout.radStraight;
        var rf = layout.radFlare;
        var yTop = layout.yStraightTop;
        var yBot = layout.yStraightBottom;
        var flareOut = layout.pxFlareOut || FLARE_OUT_MM;
        var flareIn = layout.pxFlareIn || FLARE_IN_MM;
        if (y < yTop) {
            var u = Math.max(0, Math.min(1, (yTop - y) / flareOut));
            return rs + (rf - rs) * (0.4 + 0.6 * Math.sin(u * Math.PI * 0.5));
        }
        if (y > yBot) {
            var v = Math.max(0, Math.min(1, (y - yBot) / flareIn));
            return rs + (rf - rs) * (1 - 0.2 * v);
        }
        return rs;
    }

    function clipToValve(ctx, centerX, layout) {
        ctx.beginPath();
        global.drawValvePath(ctx, centerX, layout.radStraight, layout.radFlare,
            layout.yStraightTop, layout.yStraightBottom, layout.yOutflowTop, layout.yInflowBottom, layout.pxFlareOut);
    }

    function stentRowYs(layout) {
        var y = [];
        y.push(layout.yOutflowTop);
        y.push(layout.yOutflowTop + layout.pxFlareOut * 0.48);
        y.push(layout.yStraightTop);
        var bodyRows = Math.max(4, Math.round(layout.pxStentLen / Math.max(9, layout.radStraight * 0.48)));
        for (var i = 1; i < bodyRows; i++) {
            y.push(layout.yStraightTop + (layout.yStraightBottom - layout.yStraightTop) * i / bodyRows);
        }
        y.push(layout.yStraightBottom);
        y.push(layout.yStraightBottom + layout.pxFlareIn * 0.52);
        y.push(layout.yInflowBottom);
        return y;
    }

    function stentPoint(centerX, layout, angle, y) {
        var radius = valveRadiusAtY(y, layout);
        return {
            x: centerX + Math.sin(angle) * radius,
            y: y,
            depth: Math.cos(angle)
        };
    }

    function traceProjectedStrut(ctx, centerX, layout, a0, y0, a1, y1) {
        var delta = a1 - a0;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        var steps = 7;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var ease = t * t * (3 - 2 * t);
            var angle = a0 + delta * ease;
            var yy = y0 + (y1 - y0) * t;
            var p = stentPoint(centerX, layout, angle, yy);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
    }

    function strokeMetalStrut(ctx, centerX, layout, segment, style, front) {
        var alpha = front ? style.frontAlpha : style.backAlpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        traceProjectedStrut(ctx, centerX, layout, segment.a0, segment.y0, segment.a1, segment.y1);
        ctx.strokeStyle = 'rgba(18, 22, 27,' + alpha + ')';
        ctx.lineWidth = style.strutWidth + (front ? 1.6 : 0.8);
        ctx.stroke();

        ctx.beginPath();
        traceProjectedStrut(ctx, centerX, layout, segment.a0, segment.y0, segment.a1, segment.y1);
        ctx.strokeStyle = 'rgba(164, 172, 178,' + (alpha * 0.95) + ')';
        ctx.lineWidth = Math.max(0.7, style.strutWidth * 0.52);
        ctx.stroke();
    }

    function drawRealisticStentLattice(ctx, centerX, layout, style) {
        var ys = stentRowYs(layout);
        var columns = 12;
        var halfStep = Math.PI / columns;
        var segments = [];

        for (var r = 1; r < ys.length - 2; r++) {
            var phase0 = (r % 2) * halfStep;
            var phase1 = ((r + 1) % 2) * halfStep;
            for (var c = 0; c < columns; c++) {
                var a0 = c * Math.PI * 2 / columns + phase0;
                var next = c * Math.PI * 2 / columns + phase1;
                var prev = (c - 1) * Math.PI * 2 / columns + phase1;
                segments.push({ a0: a0, y0: ys[r], a1: next, y1: ys[r + 1],
                    depth: Math.cos((a0 + next) / 2) });
                segments.push({ a0: a0, y0: ys[r], a1: prev, y1: ys[r + 1],
                    depth: Math.cos((a0 + prev) / 2) });
            }
        }

        /* Back wall first, then front wall: this gives the open frame cylindrical depth. */
        for (var pass = 0; pass < 2; pass++) {
            for (var s = 0; s < segments.length; s++) {
                var front = segments[s].depth >= 0;
                if ((pass === 0 && !front) || (pass === 1 && front)) {
                    strokeMetalStrut(ctx, centerX, layout, segments[s], style, front);
                }
            }
        }
    }

    function drawEndCrown(ctx, centerX, layout, style, top) {
        var yTip = top ? layout.yOutflowTop : layout.yInflowBottom;
        var yJoin = top
            ? layout.yOutflowTop + layout.pxFlareOut * 0.48
            : layout.yInflowBottom - layout.pxFlareIn * 0.48;
        var columns = 12;
        var step = Math.PI * 2 / columns;
        var segments = [];
        for (var c = 0; c < columns; c++) {
            var tipA = c * step;
            var leftA = tipA - step * 0.5;
            var rightA = tipA + step * 0.5;
            segments.push({ a0: leftA, y0: yJoin, a1: tipA, y1: yTip, depth: Math.cos((leftA + tipA) / 2) });
            segments.push({ a0: tipA, y0: yTip, a1: rightA, y1: yJoin, depth: Math.cos((tipA + rightA) / 2) });
        }
        for (var pass = 0; pass < 2; pass++) {
            for (var i = 0; i < segments.length; i++) {
                var front = segments[i].depth >= 0;
                if ((pass === 0 && !front) || (pass === 1 && front)) {
                    strokeMetalStrut(ctx, centerX, layout, segments[i], style, front);
                }
            }
        }
    }

    function drawEndRim(ctx, centerX, layout, style, y) {
        var radius = valveRadiusAtY(y, layout);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(centerX, y, radius, Math.max(2, radius * 0.10), 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(21, 25, 30,' + style.frontAlpha + ')';
        ctx.lineWidth = style.strutWidth + 1.1;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(centerX, y - 0.45, radius, Math.max(2, radius * 0.10), 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(176, 184, 190,' + (style.frontAlpha * 0.88) + ')';
        ctx.lineWidth = Math.max(0.65, style.strutWidth * 0.46);
        ctx.stroke();
        ctx.restore();
    }

    function drawRadiopaqueMarkers(ctx, centerX, layout, scale) {
        var rs = layout.radStraight;
        var yTop = layout.yStraightTop;
        var yBot = layout.yStraightBottom;
        var markerW = Math.max(3, rs * 0.10);
        var markerH = Math.max(5, rs * 0.17);
        var positions = [centerX - rs * 0.62, centerX, centerX + rs * 0.62];
        var rows = [yTop, yBot];
        for (var r = 0; r < rows.length; r++) {
            for (var m = 0; m < positions.length; m++) {
                var mx = positions[m];
                var my = rows[r];
                var grd = ctx.createLinearGradient(mx - markerW, my, mx + markerW, my);
                grd.addColorStop(0, '#8A6410');
                grd.addColorStop(0.42, '#FFE27A');
                grd.addColorStop(1, '#A97812');
                ctx.fillStyle = grd;
                ctx.strokeStyle = '#6D5010';
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.ellipse(mx, my, markerW / 2, markerH / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    function drawValveOutline(ctx, centerX, layout, style) {
        clipToValve(ctx, centerX, layout);
        if (style.fill) {
            ctx.fillStyle = style.fill;
            ctx.fill();
        }
        ctx.strokeStyle = style.outline;
        ctx.lineWidth = style.outlineWidth || 1.5;
        ctx.stroke();
    }

    global.drawTechnicalStentMesh = function (ctx, centerX, layout, view) {
        var isTech = view === 'valve';
        var isOverlay = view === 'deploy' || view === 'anatomy';
        var style = isTech ? {
            strutWidth: 2.15,
            frontAlpha: 0.94,
            backAlpha: 0.25
        } : {
            strutWidth: 1.65,
            frontAlpha: 0.88,
            backAlpha: 0.20
        };

        if (isOverlay) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
        }

        drawRealisticStentLattice(ctx, centerX, layout, style);
        drawEndCrown(ctx, centerX, layout, style, true);
        drawEndCrown(ctx, centerX, layout, style, false);
        drawEndRim(ctx, centerX, layout, style, layout.yOutflowTop);
        drawEndRim(ctx, centerX, layout, style, layout.yInflowBottom);
        drawRadiopaqueMarkers(ctx, centerX, layout, 1);

        if (isOverlay) ctx.restore();

        var yMid = layout.yCenter || ((layout.yStraightTop + layout.yStraightBottom) / 2);
        if (view === 'deploy') {
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 72, 252, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(centerX - layout.radStraight - 28, yMid);
            ctx.lineTo(centerX + layout.radStraight + 28, yMid);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#6448FC';
            ctx.beginPath();
            ctx.arc(centerX, yMid, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    };

    global.buildValveLayoutForCanvas = function (canvasW, canvasH, straightOD, stentLen, padding) {
        padding = padding || { top: 18, bottom: 18, side: 24 };
        var availH = canvasH - padding.top - padding.bottom;
        var totalMm = stentLen + FLARE_OUT_MM + FLARE_IN_MM + 8;
        var scale = availH / totalMm;
        var pxStentLen = stentLen * scale;
        var pxFlareOut = FLARE_OUT_MM * scale;
        var pxFlareIn = FLARE_IN_MM * scale;
        var radStraight = (straightOD * scale) / 2;
        var radFlare = ((straightOD + 10) * scale) / 2;
        var totalDrawH = pxStentLen + pxFlareOut + pxFlareIn;
        var yOutflowTop = padding.top + (availH - totalDrawH) / 2;
        var yStraightTop = yOutflowTop + pxFlareOut;
        var yStraightBottom = yStraightTop + pxStentLen;
        var yInflowBottom = yStraightBottom + pxFlareIn;
        return {
            centerX: canvasW / 2,
            yCenter: (yStraightTop + yStraightBottom) / 2,
            yOutflowTop: yOutflowTop,
            yStraightTop: yStraightTop,
            yStraightBottom: yStraightBottom,
            yInflowBottom: yInflowBottom,
            radStraight: radStraight,
            radFlare: radFlare,
            pxFlareOut: pxFlareOut,
            pxFlareIn: pxFlareIn,
            pxStentLen: pxStentLen,
            scale: scale
        };
    };

    global.renderValveTechnicalDrawing = function (canvas, sku, options) {
        if (!canvas) return;
        options = options || {};
        var dims = global.parseValveSku(sku);
        var ctx = canvas.getContext('2d');
        var w = canvas.width;
        var h = canvas.height;
        var dark = !!options.darkBg;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = dark ? '#0B0C10' : '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        var layout = global.buildValveLayoutForCanvas(w, h, dims.straightOD, dims.stentLen, options.padding);
        global.drawTechnicalStentMesh(ctx, layout.centerX, layout, 'valve');

        if (options.showSku !== false) {
            ctx.fillStyle = dark ? 'rgba(200, 210, 225, 0.85)' : '#6B7280';
            ctx.font = '10px "Space Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(dims.sku + ' · B ' + dims.straightOD + 'mm · D ' + dims.stentLen + 'mm', 8, h - 8);
        }
        return canvas.toDataURL('image/png');
    };

    global.drawPhuocValveLabels = function (ctx, centerX, layout, straightOD, stentLenVal, totalLenText) {
        var d1 = straightOD + 10;
        var d2 = straightOD;
        var d3 = straightOD + 10;
        global.drawHorizontalCaliperLeft(ctx, centerX - layout.radFlare - 12, layout.yOutflowTop,
            'D1 proximal: ' + d1 + ' mm', '#171434');
        global.drawHorizontalCaliperLeft(ctx, centerX - layout.radStraight - 12,
            (layout.yStraightTop + layout.yStraightBottom) / 2, 'D2 waist: ' + d2 + ' mm', '#302B6A');
        global.drawHorizontalCaliperLeft(ctx, centerX - layout.radFlare - 12, layout.yInflowBottom,
            'D3 distal: ' + d3 + ' mm', '#171434');
        global.drawVerticalCaliper(ctx, centerX + layout.radStraight + 28, layout.yOutflowTop, layout.yStraightTop,
            'L1: ' + FLARE_OUT_MM + ' mm', '#D97706');
        global.drawVerticalCaliper(ctx, centerX + layout.radStraight + 55, layout.yStraightTop, layout.yStraightBottom,
            'L2: ' + stentLenVal + ' mm', '#171434');
        global.drawVerticalCaliper(ctx, centerX + layout.radFlare + 75, layout.yStraightBottom, layout.yInflowBottom,
            'L3: ' + FLARE_IN_MM + ' mm', '#D97706');
        global.drawVerticalCaliper(ctx, centerX + layout.radFlare + 105, layout.yOutflowTop, layout.yInflowBottom,
            'E: ' + totalLenText, '#6448FC');
    };

    global.onValveViewerUIChange = function () {
        readViewerStateFromUI();
        if (typeof global.updateUI === 'function') global.updateUI();
    };

    function bindCanvasValveDrag() {
        var canvas = document.getElementById('deploymentCanvas');
        if (!canvas || canvas.dataset.valveDragBound === '1') return;
        canvas.dataset.valveDragBound = '1';

        canvas.addEventListener('mousedown', function (e) {
            var view = global.currentCanvasView;
            if (view === 'anatomy') return;
            dragState.active = true;
            dragState.startY = e.clientY;
            dragState.startOffset = global.valveViewerState.offsetMm;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', function (e) {
            if (!dragState.active) return;
            var scale = global.valveViewerState.canvasScale || 1;
            var deltaMm = (e.clientY - dragState.startY) / scale;
            setOffsetMm(dragState.startOffset + deltaMm);
        });

        window.addEventListener('mouseup', function () {
            if (!dragState.active) return;
            dragState.active = false;
            var canvas = document.getElementById('deploymentCanvas');
            if (canvas) canvas.style.cursor = '';
        });

        canvas.addEventListener('mouseenter', function () {
            if (global.currentCanvasView !== 'anatomy') canvas.style.cursor = 'grab';
        });
        canvas.addEventListener('mouseleave', function () {
            if (!dragState.active) canvas.style.cursor = '';
        });
    }

    global.bindValveViewerUI = function () {
        var sel = document.getElementById('in-landmark');
        if (sel && sel.dataset.bound !== '1') {
            sel.dataset.bound = '1';
            sel.addEventListener('change', function () {
                sel.dataset.userSet = '1';
                global.onValveViewerUIChange();
            });
        }
        var off = document.getElementById('in-valve-offset');
        if (off && off.dataset.bound !== '1') {
            off.dataset.bound = '1';
            off.addEventListener('input', global.onValveViewerUIChange);
        }
        bindCanvasValveDrag();
    };

})(typeof window !== 'undefined' ? window : this);
