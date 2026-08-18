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

    var patient3d = {
        rotX: 0.42,
        rotY: 0.85,
        valveRotY: 0,
        zoom: 1,
        drag: null,
        lastX: 0,
        lastY: 0,
        startOffset: 0,
        startRotY: 0,
        startRotX: 0,
        startValveRot: 0
    };

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function project3D(x, y, z, cam) {
        var cy = Math.cos(cam.rotY), sy = Math.sin(cam.rotY);
        var cx = Math.cos(cam.rotX), sx = Math.sin(cam.rotX);
        var x1 = x * cy - z * sy;
        var z1 = x * sy + z * cy;
        var y1 = y * cx - z1 * sx;
        var z2 = y * sx + z1 * cx;
        var dist = cam.distance;
        var persp = dist / (dist + z2);
        return {
            x: cam.cx + x1 * persp * cam.zoom,
            y: cam.cy - y1 * persp * cam.zoom,
            z: z2,
            persp: persp
        };
    }

    function interpRadius(rings, y) {
        if (!rings.length) return 10;
        if (y <= rings[0].y) return rings[0].r;
        for (var i = 1; i < rings.length; i++) {
            if (y <= rings[i].y) {
                var t = (y - rings[i - 1].y) / (rings[i].y - rings[i - 1].y);
                return rings[i - 1].r + (rings[i].r - rings[i - 1].r) * t;
            }
        }
        return rings[rings.length - 1].r;
    }

    function buildAnatomyWireframe(tablePlanes, phase, stJ, bif, mmScale) {
        var pref = phase === 'diastole' ? 'd' : 's';
        var rings = [];
        var segments = [];
        var meridians = 14;

        for (var i = 0; i < tablePlanes.length; i++) {
            var p = tablePlanes[i];
            var adj = getPhaseAdjustedDist(p.dist, phase, stJ, bif);
            var r = ((p[pref + '1'] + p[pref + '2']) / 2) * mmScale * 0.5;
            rings.push({ y: adj * mmScale, r: r, name: p.name || '' });
        }
        rings.sort(function (a, b) { return a.y - b.y; });

        var yMin = rings[0].y - 8 * mmScale;
        var yMax = rings[rings.length - 1].y + 14 * mmScale;
        var ringStep = 3 * mmScale;
        var contourRings = [];
        for (var y = yMin; y <= yMax; y += ringStep) {
            contourRings.push({ y: y, r: interpRadius(rings, y) });
        }

        for (var ri = 0; ri < contourRings.length; ri++) {
            var cr = contourRings[ri];
            var pts = [];
            for (var m = 0; m < meridians; m++) {
                var a = (m / meridians) * Math.PI * 2;
                pts.push({ x: Math.cos(a) * cr.r, y: cr.y, z: Math.sin(a) * cr.r });
            }
            for (var pti = 0; pti < pts.length; pti++) {
                var nxt = (pti + 1) % pts.length;
                segments.push({ a: pts[pti], b: pts[nxt], kind: 'anatomy-ring', depth: cr.y });
            }
        }

        for (var mi = 0; mi < meridians; mi++) {
            var ang = (mi / meridians) * Math.PI * 2;
            var prev = null;
            for (var ci = 0; ci < contourRings.length; ci++) {
                var pt = {
                    x: Math.cos(ang) * contourRings[ci].r,
                    y: contourRings[ci].y,
                    z: Math.sin(ang) * contourRings[ci].r
                };
                if (prev) segments.push({ a: prev, b: pt, kind: 'anatomy-meridian', depth: contourRings[ci].y });
                prev = pt;
            }
        }

        var bifY = bif * mmScale;
        var bifR = interpRadius(rings, bifY);
        var branchLen = 16 * mmScale;
        var branchSpread = 0.55;
        [['LPA', -1], ['RPA', 1]].forEach(function (br) {
            var side = br[1];
            var bx = side * bifR * branchSpread;
            var bz = bifR * 0.35;
            var top = { x: bx, y: bifY + branchLen, z: bz };
            var rootA = { x: side * bifR * 0.35, y: bifY, z: bifR * 0.2 };
            var rootB = { x: side * bifR * 0.75, y: bifY + branchLen * 0.35, z: bifR * 0.55 };
            segments.push({ a: rootA, b: top, kind: 'anatomy-branch', depth: bifY });
            segments.push({ a: rootB, b: top, kind: 'anatomy-branch', depth: bifY });
            for (var bi = 0; bi < 6; bi++) {
                var t = bi / 5;
                var ringY = bifY + branchLen * t;
                var ringR = bifR * (0.35 + 0.12 * (1 - t));
                var ringPts = [];
                for (var bj = 0; bj < 8; bj++) {
                    var ba = (bj / 8) * Math.PI * 2 + side * 0.3;
                    ringPts.push({
                        x: bx + Math.cos(ba) * ringR * 0.55,
                        y: ringY,
                        z: bz + Math.sin(ba) * ringR * 0.45
                    });
                }
                for (var rk = 0; rk < ringPts.length; rk++) {
                    var rn = (rk + 1) % ringPts.length;
                    segments.push({ a: ringPts[rk], b: ringPts[rn], kind: 'anatomy-branch', depth: ringY });
                }
            }
        });

        return { segments: segments, rings: rings, yMin: yMin, yMax: yMax };
    }

    function valveRadiusAt(y, centerY, rWaist, rFlare, hStent, hOut, hIn) {
        var yTop = centerY - hStent / 2;
        var yBot = centerY + hStent / 2;
        if (y < yTop) {
            var u = clamp((yTop - y) / hOut, 0, 1);
            return rWaist + (rFlare - rWaist) * (0.35 + 0.65 * Math.sin(u * Math.PI * 0.5));
        }
        if (y > yBot) {
            var v = clamp((y - yBot) / hIn, 0, 1);
            return rWaist + (rFlare - rWaist) * (1 - 0.25 * v * v);
        }
        return rWaist;
    }

    function rotateYPoint(x, y, z, angle) {
        var c = Math.cos(angle), s = Math.sin(angle);
        return { x: x * c - z * s, y: y, z: x * s + z * c };
    }

    function buildValveWireframe(straightOD, stentLen, centerY, mmScale, valveRotY) {
        var segments = [];
        var rWaist = straightOD * mmScale * 0.5;
        var rFlare = (straightOD + 10) * mmScale * 0.5;
        var hStent = stentLen * mmScale;
        var hOut = FLARE_OUT_MM * mmScale;
        var hIn = FLARE_IN_MM * mmScale;
        var yTop = centerY - hStent / 2 - hOut;
        var yBot = centerY + hStent / 2 + hIn;
        var struts = 16;
        var ringStep = 2.2 * mmScale;

        function addSeg(a, b, kind, dashed) {
            var ra = rotateYPoint(a.x, a.y, a.z, valveRotY);
            var rb = rotateYPoint(b.x, b.y, b.z, valveRotY);
            segments.push({ a: ra, b: rb, kind: kind || 'valve', dashed: !!dashed, depth: (ra.y + rb.y) / 2 });
        }

        var contour = [];
        for (var y = yTop; y <= yBot + 0.01; y += ringStep) {
            contour.push({ y: y, r: valveRadiusAt(y, centerY, rWaist, rFlare, hStent, hOut, hIn) });
        }

        for (var ci = 0; ci < contour.length; ci++) {
            var ringPts = [];
            for (var si = 0; si < struts; si++) {
                var ang = (si / struts) * Math.PI * 2;
                ringPts.push({
                    x: Math.cos(ang) * contour[ci].r,
                    y: contour[ci].y,
                    z: Math.sin(ang) * contour[ci].r
                });
            }
            for (var rp = 0; rp < ringPts.length; rp++) {
                var rn = (rp + 1) % ringPts.length;
                addSeg(ringPts[rp], ringPts[rn], 'valve-ring');
            }
        }

        for (var mi = 0; mi < struts; mi++) {
            var angM = (mi / struts) * Math.PI * 2;
            var prev = null;
            for (var ri = 0; ri < contour.length; ri++) {
                var pt = {
                    x: Math.cos(angM) * contour[ri].r,
                    y: contour[ri].y,
                    z: Math.sin(angM) * contour[ri].r
                };
                if (prev) addSeg(prev, pt, 'valve-strut');
                prev = pt;
            }
        }

        var yStraightTop = centerY - hStent / 2;
        var yStraightBot = centerY + hStent / 2;
        for (var yi = 0; yi < contour.length - 1; yi++) {
            if (contour[yi].y < yStraightTop || contour[yi + 1].y > yStraightBot) continue;
            for (var di = 0; di < struts; di++) {
                var a0 = (di / struts) * Math.PI * 2;
                var a1 = a0 + Math.PI / struts;
                var p0 = { x: Math.cos(a0) * contour[yi].r, y: contour[yi].y, z: Math.sin(a0) * contour[yi].r };
                var p1 = { x: Math.cos(a1) * contour[yi + 1].r, y: contour[yi + 1].y, z: Math.sin(a1) * contour[yi + 1].r };
                addSeg(p0, p1, 'valve-mesh');
                var p2 = { x: Math.cos(a1) * contour[yi].r, y: contour[yi].y, z: Math.sin(a1) * contour[yi].r };
                var p3 = { x: Math.cos(a0) * contour[yi + 1].r, y: contour[yi + 1].y, z: Math.sin(a0) * contour[yi + 1].r };
                addSeg(p2, p3, 'valve-mesh');
            }
        }

        var crownCount = 8;
        var crownBaseY = centerY - hStent / 2;
        var crownTopY = yTop;
        for (var ck = 0; ck < crownCount; ck++) {
            var ca = (ck / crownCount) * Math.PI * 2;
            var base = { x: Math.cos(ca) * rWaist * 0.92, y: crownBaseY, z: Math.sin(ca) * rWaist * 0.92 };
            var tip = { x: Math.cos(ca + 0.2) * rFlare * 0.55, y: crownTopY + 2 * mmScale, z: Math.sin(ca + 0.2) * rFlare * 0.55 };
            addSeg(base, tip, 'valve-crown');
            var neighbor = (ck + 1) % crownCount;
            var ca2 = (neighbor / crownCount) * Math.PI * 2;
            var tip2 = { x: Math.cos(ca2 + 0.2) * rFlare * 0.55, y: crownTopY + 2 * mmScale, z: Math.sin(ca2 + 0.2) * rFlare * 0.55 };
            addSeg(tip, tip2, 'valve-crown');
        }

        var petals = 6;
        var petalBaseY = centerY + hStent / 2;
        for (var pe = 0; pe < petals; pe++) {
            var pa = (pe / petals) * Math.PI * 2 + Math.PI / petals;
            var pBase = { x: Math.cos(pa) * rWaist * 0.9, y: petalBaseY, z: Math.sin(pa) * rWaist * 0.9 };
            var pTip = { x: Math.cos(pa) * rFlare * 0.82, y: yBot, z: Math.sin(pa) * rFlare * 0.82 };
            addSeg(pBase, pTip, 'valve-petal');
        }

        for (var li = 0; li < 3; li++) {
            var la = (li / 3) * Math.PI * 2 + valveRotY;
            var leafTip = { x: Math.cos(la) * rWaist * 0.78, y: crownTopY + 1.5 * mmScale, z: Math.sin(la) * rWaist * 0.78 };
            addSeg({ x: 0, y: crownTopY + 1.5 * mmScale, z: 0 }, leafTip, 'valve-leaflet');
        }

        var land = { x: 0, y: centerY, z: 0 };
        segments.push({ a: land, b: land, kind: 'landmark', depth: centerY, landmark: true });

        return { segments: segments, yTop: yTop, yBot: yBot, centerY: centerY };
    }

    function drawWireSegments(ctx, segments, cam, styleMap) {
        var projected = [];
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            if (seg.landmark) {
                var lp = project3D(seg.a.x, seg.a.y, seg.a.z, cam);
                projected.push({ seg: seg, pa: lp, pb: lp, avgZ: lp.z });
                continue;
            }
            var pa = project3D(seg.a.x, seg.a.y, seg.a.z, cam);
            var pb = project3D(seg.b.x, seg.b.y, seg.b.z, cam);
            projected.push({ seg: seg, pa: pa, pb: pb, avgZ: (pa.z + pb.z) / 2 });
        }
        projected.sort(function (a, b) { return a.avgZ - b.avgZ; });

        for (var j = 0; j < projected.length; j++) {
            var item = projected[j];
            var seg = item.seg;
            if (seg.landmark) {
                ctx.fillStyle = '#6448FC';
                ctx.beginPath();
                ctx.arc(item.pa.x, item.pa.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 1;
                ctx.stroke();
                continue;
            }
            var style = styleMap[seg.kind] || styleMap.valve;
            var depthFade = clamp(0.35 + (item.avgZ + 120) / 220, 0.25, 1);
            ctx.strokeStyle = style.color.replace('ALPHA', String(style.alpha * depthFade));
            ctx.lineWidth = style.width * ((item.pa.persp + item.pb.persp) / 2);
            if (seg.dashed) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(item.pa.x, item.pa.y);
            ctx.lineTo(item.pb.x, item.pb.y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
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

        ctx.fillStyle = '#08080c';
        ctx.fillRect(0, 0, w, h);

        if (!tablePlanes || tablePlanes.length < 2) {
            ctx.fillStyle = '#d1d5db';
            ctx.font = '14px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Enter measurement planes to view 3D anatomy', w / 2, h / 2);
            return;
        }

        var mmScale = 3.6;
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        var straightOD = parseInt(sku.split('-')[0].replace('P', ''), 10) || 28;
        var stentLen = parseInt(sku.split('-')[1], 10) || 25;
        var landDist = global.getLandmarkAnchorDist(tablePlanes, landmark) + (offsetMm || 0);
        var valveCenterY = landDist * mmScale;

        var anatomy = buildAnatomyWireframe(tablePlanes, phase, stJ, bif, mmScale);
        var valve = buildValveWireframe(straightOD, stentLen, valveCenterY, mmScale, patient3d.valveRotY);

        var spanY = anatomy.yMax - anatomy.yMin + 40 * mmScale;
        var cam = {
            rotX: patient3d.rotX,
            rotY: patient3d.rotY,
            distance: spanY * 2.4,
            zoom: patient3d.zoom * (h / 520),
            cx: w * 0.5,
            cy: h * 0.54
        };

        var gridY = anatomy.yMin;
        ctx.strokeStyle = 'rgba(80, 90, 110, 0.18)';
        ctx.lineWidth = 1;
        for (var gx = -80; gx <= 80; gx += 20) {
            var g1 = project3D(gx, gridY, -80, cam);
            var g2 = project3D(gx, gridY, 80, cam);
            ctx.beginPath(); ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.stroke();
            var g3 = project3D(-80, gridY, gx, cam);
            var g4 = project3D(80, gridY, gx, cam);
            ctx.beginPath(); ctx.moveTo(g3.x, g3.y); ctx.lineTo(g4.x, g4.y); ctx.stroke();
        }

        var anatomyStyle = {
            'anatomy-ring': { color: 'rgba(180, 195, 210, ALPHA)', alpha: 0.55, width: 0.8 },
            'anatomy-meridian': { color: 'rgba(140, 155, 175, ALPHA)', alpha: 0.45, width: 0.7 },
            'anatomy-branch': { color: 'rgba(160, 175, 195, ALPHA)', alpha: 0.5, width: 0.75 }
        };
        var valveStyle = {
            valve: { color: 'rgba(230, 200, 160, ALPHA)', alpha: 0.95, width: 1.1 },
            'valve-ring': { color: 'rgba(245, 230, 200, ALPHA)', alpha: 1, width: 1.25 },
            'valve-strut': { color: 'rgba(255, 240, 210, ALPHA)', alpha: 0.95, width: 1.05 },
            'valve-mesh': { color: 'rgba(220, 200, 170, ALPHA)', alpha: 0.85, width: 0.85 },
            'valve-crown': { color: 'rgba(255, 245, 220, ALPHA)', alpha: 1, width: 1.2 },
            'valve-petal': { color: 'rgba(255, 240, 210, ALPHA)', alpha: 0.95, width: 1.1 },
            'valve-leaflet': { color: 'rgba(255, 255, 255, ALPHA)', alpha: 0.9, width: 1.15 }
        };

        drawWireSegments(ctx, anatomy.segments, cam, anatomyStyle);
        drawWireSegments(ctx, valve.segments, cam, valveStyle);

        var landP = project3D(0, valveCenterY, 0, cam);
        ctx.strokeStyle = 'rgba(100, 72, 252, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        var ldx = 34;
        ctx.beginPath();
        ctx.moveTo(landP.x - ldx, landP.y);
        ctx.lineTo(landP.x + ldx, landP.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(220, 225, 235, 0.9)';
        ctx.font = '11px "Space Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('VenusP-Valve · P' + straightOD + '-' + stentLen + ' wireframe', 14, 22);
        ctx.fillText(phase.toUpperCase() + ' · landmark centre · offset ' + (offsetMm > 0 ? '+' : '') + (offsetMm || 0).toFixed(1) + ' mm', 14, 38);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(160, 170, 185, 0.95)';
        ctx.fillText('Drag ↔ orbit · Drag ↕ move valve · Shift+drag ↔ rotate valve', w / 2, h - 14);
    };

    function bindPatient3DDrag() {
        var canvas = document.getElementById('patient3dCanvas');
        if (!canvas || canvas.dataset.p3dBound === '1') return;
        canvas.dataset.p3dBound = '1';

        canvas.addEventListener('mousedown', function (e) {
            if (global.currentCanvasView !== 'patient3d') return;
            patient3d.drag = e.shiftKey ? 'valve-rot' : 'view';
            patient3d.lastX = e.clientX;
            patient3d.lastY = e.clientY;
            patient3d.startOffset = global.valveViewerState.offsetMm || 0;
            patient3d.startRotY = patient3d.rotY;
            patient3d.startRotX = patient3d.rotX;
            patient3d.startValveRot = patient3d.valveRotY;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', function (e) {
            if (!patient3d.drag) return;
            var dx = e.clientX - patient3d.lastX;
            var dy = e.clientY - patient3d.lastY;
            if (patient3d.drag === 'valve-rot') {
                patient3d.valveRotY = patient3d.startValveRot + dx * 0.018;
            } else if (e.altKey) {
                patient3d.rotY = patient3d.startRotY + dx * 0.012;
                patient3d.rotX = clamp(patient3d.startRotX + dy * 0.008, 0.12, 1.2);
            } else {
                patient3d.rotY = patient3d.startRotY + dx * 0.012;
                setOffsetMm(patient3d.startOffset - dy * 0.08);
            }
            if (typeof global.drawRVOTCanvas === 'function') global.drawRVOTCanvas();
        });

        window.addEventListener('mouseup', function () {
            if (!patient3d.drag) return;
            patient3d.drag = null;
            var c = document.getElementById('patient3dCanvas');
            if (c) c.style.cursor = 'grab';
        });

        canvas.addEventListener('wheel', function (e) {
            if (global.currentCanvasView !== 'patient3d') return;
            patient3d.zoom = clamp(patient3d.zoom * (e.deltaY > 0 ? 0.94 : 1.06), 0.55, 1.8);
            e.preventDefault();
            if (typeof global.drawRVOTCanvas === 'function') global.drawRVOTCanvas();
        }, { passive: false });

        canvas.addEventListener('mouseenter', function () {
            if (global.currentCanvasView === 'patient3d') canvas.style.cursor = 'grab';
        });
    }

})(typeof window !== 'undefined' ? window : this);
