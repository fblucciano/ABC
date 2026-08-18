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
        landmark: 'annulus',
        offsetMm: 0,
        canvasScale: 1
    };

    var dragState = { active: false, startY: 0, startOffset: 0 };

    function vEl(id) { var e = document.getElementById(id); return e ? e.value : ''; }

    function readViewerStateFromUI() {
        global.valveViewerState.landmark = vEl('in-landmark') || 'annulus';
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

    function suggestLandmarkFromMorph(morphKey) {
        if (morphKey === 'type1') return 'bifurcation';
        return 'annulus';
    }

    global.syncLandmarkSuggestion = function (morphKey) {
        var sel = document.getElementById('in-landmark');
        if (!sel || sel.dataset.userSet === '1') return;
        var suggested = suggestLandmarkFromMorph(morphKey);
        sel.value = suggested;
        global.valveViewerState.landmark = suggested;
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
        var idxValvar = tablePlanes.findIndex(function (p) { return p.id === 'valvar'; });
        var valvarDist = idxValvar >= 0 ? tablePlanes[idxValvar].dist : 0;
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        switch (landmark) {
            case 'trans_annular': return valvarDist + 3;
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

    global.drawTechnicalStentMesh = function (ctx, centerX, layout, view) {
        var y0 = layout.yOutflowTop;
        var y1 = layout.yInflowBottom;
        var rs = layout.radStraight;
        var rf = layout.radFlare;
        var alpha = view === 'valve' ? 0.55 : 0.42;

        ctx.save();
        ctx.beginPath();
        global.drawValvePath(ctx, centerX, rs, rf, layout.yStraightTop, layout.yStraightBottom,
            layout.yOutflowTop, layout.yInflowBottom, layout.pxFlareOut);
        ctx.clip();

        ctx.strokeStyle = 'rgba(23, 20, 52, 0.85)';
        ctx.lineWidth = 0.9;
        var cell = 11;
        for (var y = y0 - 15; y < y1 + 15; y += cell) {
            for (var x = centerX - rf - 25; x < centerX + rf + 25; x += cell) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + cell, y + cell);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + cell, y);
                ctx.lineTo(x, y + cell);
                ctx.stroke();
            }
        }
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        global.drawValvePath(ctx, centerX, rs, rf, layout.yStraightTop, layout.yStraightBottom,
            layout.yOutflowTop, layout.yInflowBottom, layout.pxFlareOut);
        ctx.fillStyle = view === 'valve' ? 'rgba(230, 138, 46, ' + alpha + ')' :
            'rgba(230, 138, 46, ' + (alpha - 0.1) + ')';
        ctx.fill();
        ctx.strokeStyle = '#171434';
        ctx.lineWidth = view === 'valve' ? 2.2 : 1.8;
        ctx.stroke();
        ctx.restore();

        var yMid = layout.yCenter || ((layout.yStraightTop + layout.yStraightBottom) / 2);
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 72, 252, 0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(centerX - rs - 32, yMid);
        ctx.lineTo(centerX + rs + 32, yMid);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#6448FC';
        ctx.beginPath();
        ctx.arc(centerX, yMid, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 11px "Space Mono", monospace';
        ctx.textAlign = 'left';
        global.drawStrokeText(ctx, 'LANDMARK (cylinder centre)', centerX + rs + 38, yMid + 4, '#6448FC', '#FFFFFF', 4);
        ctx.restore();

        if (view === 'deploy') {
            ctx.save();
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(centerX - rs - 20, yMid);
            ctx.lineTo(centerX + rs + 20, yMid);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
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
