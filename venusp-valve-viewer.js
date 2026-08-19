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

    function drawMeshLattice(ctx, centerX, layout, style) {
        var y0 = layout.yOutflowTop;
        var y1 = layout.yInflowBottom;
        var cell = Math.max(6, layout.radStraight * 0.34);
        ctx.strokeStyle = style.mesh;
        ctx.lineWidth = style.meshWidth || 0.85;

        for (var y = y0; y < y1; y += cell * 0.68) {
            var r = valveRadiusAtY(y + cell * 0.34, layout) * 0.96;
            ctx.beginPath();
            ctx.moveTo(centerX - r, y);
            ctx.lineTo(centerX + r, y + cell * 0.68);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(centerX + r, y);
            ctx.lineTo(centerX - r, y + cell * 0.68);
            ctx.stroke();
        }

        var struts = 12;
        for (var s = 0; s < struts; s++) {
            var frac = (s + 0.5) / struts;
            var prev = null;
            for (var y2 = y0; y2 <= y1; y2 += cell * 0.55) {
                var r2 = valveRadiusAtY(y2, layout) * 0.94;
                var x = centerX - r2 + frac * r2 * 2;
                if (prev) {
                    ctx.beginPath();
                    ctx.moveTo(prev.x, prev.y);
                    ctx.lineTo(x, y2);
                    ctx.stroke();
                }
                prev = { x: x, y: y2 };
            }
        }

        if (style.backMesh) {
            ctx.strokeStyle = style.backMesh;
            ctx.lineWidth = (style.meshWidth || 0.85) * 0.75;
            for (var yb = y0 + cell * 0.3; yb < y1; yb += cell * 0.68) {
                var rb = valveRadiusAtY(yb, layout) * 0.82;
                ctx.beginPath();
                ctx.moveTo(centerX - rb + 3, yb + 2);
                ctx.lineTo(centerX + rb - 3, yb + cell * 0.68 + 2);
                ctx.stroke();
            }
        }
    }

    function drawContourRings(ctx, centerX, layout, style) {
        var y0 = layout.yOutflowTop;
        var y1 = layout.yInflowBottom;
        var step = Math.max(5, layout.radStraight * 0.28);
        ctx.strokeStyle = style.outline;
        ctx.lineWidth = (style.outlineWidth || 1.5) * 0.65;
        for (var y = y0; y <= y1; y += step) {
            var r = valveRadiusAtY(y, layout);
            ctx.beginPath();
            ctx.moveTo(centerX - r, y);
            ctx.lineTo(centerX + r, y);
            ctx.stroke();
        }
    }

    function drawCrownStruts(ctx, centerX, layout, style) {
        var rs = layout.radStraight;
        var rf = layout.radFlare;
        var yBase = layout.yStraightTop;
        var yCrown = layout.yOutflowTop - 2;
        var arches = 7;
        ctx.strokeStyle = style.strut;
        ctx.lineWidth = style.strutWidth || 1.35;
        for (var i = 0; i < arches; i++) {
            var t = i / (arches - 1);
            var x = centerX - rf * 0.82 + t * rf * 1.64;
            var archH = layout.pxFlareOut * (0.55 + 0.25 * Math.sin(t * Math.PI));
            ctx.beginPath();
            ctx.moveTo(x, yBase);
            ctx.bezierCurveTo(x, yBase - archH * 0.45, centerX, yCrown, x, yCrown + 4);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(centerX - rf, yCrown);
        ctx.quadraticCurveTo(centerX, yCrown - 6, centerX + rf, yCrown);
        ctx.stroke();
    }

    function drawInflowPetals(ctx, centerX, layout, style) {
        var rs = layout.radStraight;
        var rf = layout.radFlare;
        var yBase = layout.yStraightBottom;
        var yTip = layout.yInflowBottom + 2;
        var petals = 6;
        ctx.strokeStyle = style.strut;
        ctx.lineWidth = style.strutWidth || 1.2;
        for (var p = 0; p < petals; p++) {
            var t = p / (petals - 1);
            var x = centerX - rf * 0.78 + t * rf * 1.56;
            ctx.beginPath();
            ctx.moveTo(x, yBase);
            ctx.quadraticCurveTo(x + (centerX - x) * 0.15, (yBase + yTip) / 2, x, yTip);
            ctx.stroke();
        }
    }

    function drawRadiopaqueMarkers(ctx, centerX, layout, scale) {
        var rs = layout.radStraight;
        var yTop = layout.yStraightTop;
        var yBot = layout.yStraightBottom;
        var markerW = Math.max(4, rs * 0.14);
        var markerH = Math.max(6, rs * 0.22);
        var positions = [centerX - rs * 0.62, centerX, centerX + rs * 0.62];
        var rows = [yTop, yBot];
        for (var r = 0; r < rows.length; r++) {
            for (var m = 0; m < positions.length; m++) {
                var mx = positions[m];
                var my = rows[r];
                var grd = ctx.createLinearGradient(mx - markerW, my, mx + markerW, my);
                grd.addColorStop(0, '#B8860B');
                grd.addColorStop(0.45, '#FFD700');
                grd.addColorStop(1, '#B8860B');
                ctx.fillStyle = grd;
                ctx.strokeStyle = '#8B6914';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.rect(mx - markerW / 2, my - markerH / 2, markerW, markerH);
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
            fill: null,
            outline: 'rgba(23, 20, 52, 0.9)',
            outlineWidth: 2,
            mesh: 'rgba(23, 20, 52, 0.78)',
            meshWidth: 0.95,
            strut: 'rgba(23, 20, 52, 0.88)',
            strutWidth: 1.3,
            backMesh: 'rgba(23, 20, 52, 0.28)'
        } : {
            fill: null,
            outline: 'rgba(15, 18, 28, 0.82)',
            outlineWidth: 1.45,
            mesh: 'rgba(15, 18, 28, 0.72)',
            meshWidth: 0.85,
            strut: 'rgba(15, 18, 28, 0.78)',
            strutWidth: 1.15,
            backMesh: 'rgba(15, 18, 28, 0.32)'
        };

        if (isOverlay) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.save();
        clipToValve(ctx, centerX, layout);
        ctx.clip();
        drawMeshLattice(ctx, centerX, layout, style);
        ctx.restore();

        drawContourRings(ctx, centerX, layout, style);
        drawCrownStruts(ctx, centerX, layout, style);
        drawInflowPetals(ctx, centerX, layout, style);
        drawValveOutline(ctx, centerX, layout, style);
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
        if (dark) {
            ctx.save();
            clipToValve(ctx, layout.centerX, layout);
            ctx.clip();
            ctx.strokeStyle = 'rgba(220, 225, 235, 0.55)';
            ctx.lineWidth = 0.75;
            var cell = Math.max(5, layout.radStraight * 0.34);
            for (var y = layout.yOutflowTop; y < layout.yInflowBottom; y += cell * 0.7) {
                var r = valveRadiusAtY(y + cell * 0.35, layout) * 0.95;
                ctx.beginPath();
                ctx.moveTo(layout.centerX - r, y);
                ctx.lineTo(layout.centerX + r, y + cell * 0.7);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(layout.centerX + r, y);
                ctx.lineTo(layout.centerX - r, y + cell * 0.7);
                ctx.stroke();
            }
            for (var s = 0; s < 10; s++) {
                var x = layout.centerX - layout.radStraight + (s + 0.5) / 10 * layout.radStraight * 2;
                ctx.beginPath();
                ctx.moveTo(x, layout.yStraightTop);
                ctx.lineTo(x, layout.yStraightBottom);
                ctx.stroke();
            }
            ctx.restore();
            drawCrownStruts(ctx, layout.centerX, layout, { strut: 'rgba(235, 240, 250, 0.9)', strutWidth: 1.1 });
            drawInflowPetals(ctx, layout.centerX, layout, { strut: 'rgba(235, 240, 250, 0.85)', strutWidth: 1 });
            clipToValve(ctx, layout.centerX, layout);
            ctx.strokeStyle = 'rgba(245, 248, 255, 0.95)';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            drawRadiopaqueMarkers(ctx, layout.centerX, layout, layout.scale);
        } else {
            global.drawTechnicalStentMesh(ctx, layout.centerX, layout, 'valve');
        }

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
