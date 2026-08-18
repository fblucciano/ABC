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
        if (view === 'deploy') {
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 72, 252, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(centerX - rs - 28, yMid);
            ctx.lineTo(centerX + rs + 28, yMid);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#6448FC';
            ctx.beginPath();
            ctx.arc(centerX, yMid, 4, 0, Math.PI * 2);
            ctx.fill();
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
        bindPatient3DDrag();
    };

    var patient3d = { rotY: 0.62, drag: false, lastX: 0 };

    function isoProject(x, y, z, rotY) {
        var c = Math.cos(rotY), s = Math.sin(rotY);
        return { x: x * c - z * s, y: y, z: x * s + z * c };
    }

    global.showCanvasPanels = function (view) {
        var is3d = view === 'patient3d';
        var dep = document.getElementById('deploymentCanvas');
        var p3d = document.getElementById('patient3dCanvas');
        if (dep) dep.style.display = is3d ? 'none' : 'block';
        if (p3d) p3d.style.display = is3d ? 'block' : 'none';
    };

    global.drawPatient3DCanvas = function (tablePlanes, phase, sku, offsetMm, landmark) {
        var canvas = document.getElementById('patient3dCanvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        ctx.fillStyle = '#f4f6f8';
        ctx.fillRect(0, 0, w, h);

        if (!tablePlanes || tablePlanes.length < 2) {
            ctx.fillStyle = '#171434';
            ctx.font = '14px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Enter measurement planes to view 3D anatomy', w / 2, h / 2);
            return;
        }

        var scale = 4.1;
        var cx = w * 0.5, cy = h * 0.2;
        var rotY = patient3d.rotY;
        var pref = phase === 'diastole' ? 'd' : 's';
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        var slices = [];

        for (var i = 0; i < tablePlanes.length; i++) {
            var p = tablePlanes[i];
            var adj = getPhaseAdjustedDist(p.dist, phase, stJ, bif);
            var r = ((p[pref + '1'] + p[pref + '2']) / 2) * scale * 0.5;
            var pos = isoProject(0, adj * scale, 0, rotY);
            slices.push({ r: r, x: cx + pos.x, y: cy + pos.y, z: pos.z });
        }
        slices.sort(function (a, b) { return a.z - b.z; });

        for (var j = 0; j < slices.length; j++) {
            var sl = slices[j];
            var depth = 0.5 + 0.5 * Math.max(0, Math.min(1, (sl.z + 60) / 120));
            ctx.strokeStyle = 'rgba(75, 85, 99, ' + (0.3 + depth * 0.5) + ')';
            ctx.fillStyle = 'rgba(234, 236, 239, ' + (0.15 + depth * 0.2) + ')';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(sl.x, sl.y, sl.r, sl.r * 0.36, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var k = 0; k < slices.length; k++) {
            if (k === 0) ctx.moveTo(slices[k].x, slices[k].y);
            else ctx.lineTo(slices[k].x, slices[k].y);
        }
        ctx.stroke();

        var straightOD = parseInt(sku.split('-')[0].replace('P', ''), 10) || 28;
        var stentLen = parseInt(sku.split('-')[1], 10) || 25;
        var landDist = global.getLandmarkAnchorDist(tablePlanes, landmark) + (offsetMm || 0);
        var vCenter = landDist * scale;
        var rW = straightOD * scale * 0.5;
        var rF = (straightOD + 10) * scale * 0.5;
        var hStent = stentLen * scale;
        var hFlareO = FLARE_OUT_MM * scale;
        var hFlareI = FLARE_IN_MM * scale;
        var yTop = vCenter - hStent / 2 - hFlareO;
        var yBot = vCenter + hStent / 2 + hFlareI;

        function valveRadiusAt(y) {
            if (y < vCenter - hStent / 2) {
                var u = (vCenter - hStent / 2 - y) / hFlareO;
                return rW + (rF - rW) * Math.min(1, Math.max(0, u));
            }
            if (y > vCenter + hStent / 2) {
                var v = (y - vCenter - hStent / 2) / hFlareI;
                return rW + (rF - rW) * Math.min(1, Math.max(0, v));
            }
            return rW;
        }

        function drawRing(y, r, color, lw) {
            var pos = isoProject(0, y, 0, rotY);
            ctx.strokeStyle = color;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(cx + pos.x, cy + pos.y, r, r * 0.36, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        var ringCount = 14;
        for (var ri = 0; ri <= ringCount; ri++) {
            var t = ri / ringCount;
            var yy = yTop + t * (yBot - yTop);
            drawRing(yy, valveRadiusAt(yy), '#e68a2e', ri % 3 === 0 ? 2 : 1.2);
        }

        ctx.strokeStyle = 'rgba(23, 20, 52, 0.55)';
        ctx.lineWidth = 0.9;
        for (var di = 0; di < 8; di++) {
            var a = (di / 8) * Math.PI * 2;
            var p1 = isoProject(Math.cos(a) * rW * 0.85, vCenter - hStent / 2, Math.sin(a) * rW * 0.85, rotY);
            var p2 = isoProject(Math.cos(a) * rW * 0.85, vCenter + hStent / 2, Math.sin(a) * rW * 0.85, rotY);
            ctx.beginPath();
            ctx.moveTo(cx + p1.x, cy + p1.y);
            ctx.lineTo(cx + p2.x, cy + p2.y);
            ctx.stroke();
        }

        var lm = isoProject(0, vCenter, 0, rotY);
        ctx.fillStyle = '#6448FC';
        ctx.beginPath();
        ctx.arc(cx + lm.x, cy + lm.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#171434';
        ctx.font = '11px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Drag to rotate patient anatomy · ' + phase.toUpperCase(), w / 2, h - 14);
    };

    function bindPatient3DDrag() {
        var canvas = document.getElementById('patient3dCanvas');
        if (!canvas || canvas.dataset.p3dBound === '1') return;
        canvas.dataset.p3dBound = '1';
        canvas.addEventListener('mousedown', function (e) {
            patient3d.drag = true;
            patient3d.lastX = e.clientX;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        });
        window.addEventListener('mousemove', function (e) {
            if (!patient3d.drag) return;
            patient3d.rotY += (e.clientX - patient3d.lastX) * 0.012;
            patient3d.lastX = e.clientX;
            if (typeof global.drawRVOTCanvas === 'function') global.drawRVOTCanvas();
        });
        window.addEventListener('mouseup', function () {
            patient3d.drag = false;
            var c = document.getElementById('patient3dCanvas');
            if (c) c.style.cursor = 'grab';
        });
        canvas.addEventListener('mouseenter', function () { canvas.style.cursor = 'grab'; });
    }

})(typeof window !== 'undefined' ? window : this);
