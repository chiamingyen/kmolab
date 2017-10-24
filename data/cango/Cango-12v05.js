/*==========================================================================
  Filename: Cango-12v05.js
  Rev: 12
  By: A.R.Collins
  Description: A graphics library for the canvas element.
  License: Released into the public domain, latest version at
           <http://www/arc.id.au/CanvasGraphics.html>
           Please give credit to A.R.Collins <http://www.arc.id.au>
  Report bugs to tony at arc.id.au

  Date   |Description                                                   |By
  --------------------------------------------------------------------------
  14Oct12 Rev 1.00 First release based on Cango0v43                      ARC
  29Nov12 Released as Cango2v00                                          ARC
  06May14 Released as Cango4v00                                          ARC
  14Jul14 Released as Cango-5v00                                         ARC
  09Feb15 Released as Cango-6v00                                         ARC
  20Mar15 Released as Cango-7v00                                         ARC
  21Dec15 Released as Cango-8v00                                         ARC
  28Mar17 Released as Cango-9v00                                         ARC
  10Jul17 Released as Cango-10v00                                        ARC
  10Jul17 bugfix: -ve savScale gives 0 lineWidth, use Math.abs           ARC
  14Jul17 bugfix: Text.scale pointed to skew                             ARC
  17Jul17 Use single setGridbox method
          Use setWorldCoordsSVG and setWorldCoordsRHC
          Make SVG world coordinates the default                         ARC
  18Jul17 Change setGridbox parameters to be left, bottom, right, top    ARC
  20Jul17 Rename setGridbox to gridboxPadding                            ARC
  22Jul17 Released as Cango-11v00                                        ARC
  23Jul17 bugfix: yDown not reset by gridboxPadding                      ARC
  31Jul17 Added dup method to ClipMask                                   ARC
  01Aug17 Undo matrix scaling before stroking path to preserve linewidth
          Undo scaling for dashed lines, reset to no dash after stroke   ARC
  03Aug17 bugfix: WCtoISO not reset with setWorldCoords calls            ARC
          bugfix: ClipMask missing setProperty method                    ARC
  04Aug17 bugfix: dropShadow cleared before stroking Path                ARC
  05Aug17 Single save/restore around Path stroke to make clipping work   ARC
  06Aug17 Added workaround for Firefox not clipping radial gradients bug
          Transform path coords not canvas for Shape, Path & ClipMask    ARC
  07Aug17 Use RequestAnimationFrame for drag handler callback
          Add 'z' to the closed shapeDefs
          Removed 'single parent' rule for adding an object to a Group
          bugfix: revWinding added 'z' dCmd in an array not the dCmd     ARC
  08Aug17 bugfix: bad scaling for radial gradient fill
          Apply transforms to Img border path not the canvas
          Remove savScale, hardSavScale, calc from transform matrix      ARC
  09Aug17 Renamed DrawCmd parms to parmsISO and parmsOrg to parmsWC      
          Do reset and calc of savScale in render method                 ARC
  10Aug17 Support gradient stroke colors for Paths and borders           ARC
  14Aug17 Remove transform code, use canvas built-in SVGmatrix support
          Replace WCtoISO with a single Distorter inserted at render     ARC
  15Aug17 Renamed DrawCmd parmsWC to parmsOrg and parmsISO to parmsWC
          Released as Cango-12v00                                        ARC
  28Aug17 bugfix: trigger resize handler on window resize not canvas     ARC
  04Sep17 bugfix: translate y shift for iso objs should not be scled
          with different X and Y scaling                                 ARC
  09Sep17 Drop the now unused DrawCmd.parmsOrg                           ARC
  10Sep17 bugfix: setProperty didn't allow Clip iso to be set
          Maintain cmdsAry or drawCmds, drop cmdsStr                     ARC      
  ==========================================================================*/

  // exposed globals
var Cango, Path, Shape, Img, Text, ClipMask, Group, DrawCmd,
    LinearGradient, RadialGradient, Tweener,
    initZoomPan,
    cgo2DToDrawCmds,
    drawCmdsToCgo2D,
    svgToCgo2D,
    shapeDefs;  // predefined geometric shapes in Cgo2D format

(function() {
  "use strict";

  var Obj2D,
      uniqueVal = 0,    // used to generate unique value for different Cango instances
      svgParser,
      svgToDrawCmds,
      identityMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix(),
      fullPath2Dsupport = false;
      /* (function(){
        if (Path2D)
        {
          var p = new Path2D();
          return (typeof(p.addPath) === "function");
        }
        return false;
      })();  */

  function addEvent(element, eventType, handler)
  {
    if (element.attachEvent)
    {
      return element.attachEvent('on'+eventType, handler);
    }
    return element.addEventListener(eventType, handler);
  }

  function clone(orgItem)
  {
    var newItem, i;

    if (orgItem === undefined)
      {return;}
    if (orgItem === null)
      {return null;}
    newItem = (Array.isArray(orgItem)) ? [] : {};
    for (i in orgItem)
    {
      if (orgItem[i] && typeof orgItem[i] === "object")
      {
        newItem[i] = clone(orgItem[i]);
      }
      else
      {
        newItem[i] = orgItem[i];
      }
    }
    return newItem;
  }

  if (!Date.now)
  {
    Date.now = function now()
    {
      return new Date().getTime();
    };
  }

  if (!Array.prototype.contains)
  {
    Array.prototype.contains = function (v)
    {
      return this.indexOf(v) > -1;
    };
  }

  DrawCmd = function(cmdStr, coords)   // coords in world coords [cp1x,cp1y, cp2x,cp2y, ... x,y]
  {
    var i;

    this.drawFn = cmdStr;  // String version of the canvas command to call
    this.parmsWC = [];    // parms with Y coords scaled for use in ISO scaled world coords
    for (i=0; i<coords.length; i+=2)
    {
      this.parmsWC.push(coords.slice(i, i+2));     
    }
  };

  svgParser = (function ()
  {
    var segmentToBezier = function(cx, cy, th0, th1, rx, ry, sin_th, cos_th) {
          var a00 = cos_th * rx,
              a01 = -sin_th * ry,
              a10 = sin_th * rx,
              a11 = cos_th * ry,
              th_half = 0.5 * (th1 - th0),
              t = (8/3) * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half),
              x1 = cx + Math.cos(th0) - t * Math.sin(th0),
              y1 = cy + Math.sin(th0) + t * Math.cos(th0),
              x3 = cx + Math.cos(th1),
              y3 = cy + Math.sin(th1),
              x2 = x3 + t * Math.sin(th1),
              y2 = y3 - t * Math.cos(th1);

          return [ a00 * x1 + a01 * y1, a10 * x1 + a11 * y1,
                   a00 * x2 + a01 * y2, a10 * x2 + a11 * y2,
                   a00 * x3 + a01 * y3, a10 * x3 + a11 * y3 ];
        },
        arcToBezier = function(ox, oy, radx, rady, rotateX, large, sweep, x, y)
        {
          var th = rotateX * (Math.PI/180),
              sin_th = Math.sin(th),
              cos_th = Math.cos(th),
              rx = Math.abs(radx),
              ry = Math.abs(rady),
              px = cos_th * (ox - x) * 0.5 + sin_th * (oy - y) * 0.5,
              py = cos_th * (oy - y) * 0.5 - sin_th * (ox - x) * 0.5,
              pl = (px*px) / (rx*rx) + (py*py) / (ry*ry),
              a00, a01, a10, a11,
              x0, y0, x1, y1,
              d,
              sfactor_sq,
              sfactor,
              xc, yc,
              th0, th1,
              th_arc,
              segments,
              seg, tidySeg,
              result = [],
              i, th2, th3;

          function roundZeros(coord)
          {
            return ((Math.abs(coord) < 0.00001)? 0: coord);
          }

          if (pl > 1)
          {
            pl = Math.sqrt(pl);
            rx *= pl;
            ry *= pl;
          }
          a00 = cos_th / rx;
          a01 = sin_th / rx;
          a10 = -sin_th / ry;
          a11 = cos_th / ry;
          x0 = a00 * ox + a01 * oy;
          y0 = a10 * ox + a11 * oy;
          x1 = a00 * x + a01 * y;
          y1 = a10 * x + a11 * y;
          d = (x1-x0) * (x1-x0) + (y1-y0) * (y1-y0);
          sfactor_sq = 1 / d - 0.25;
          if (sfactor_sq < 0)
          {
            sfactor_sq = 0;
          }
          sfactor = Math.sqrt(sfactor_sq);
          if (sweep === large)
          {
            sfactor = -sfactor;
          }
          xc = 0.5 * (x0 + x1) - sfactor * (y1-y0);
          yc = 0.5 * (y0 + y1) + sfactor * (x1-x0);
          th0 = Math.atan2(y0-yc, x0-xc);
          th1 = Math.atan2(y1-yc, x1-xc);
          th_arc = th1-th0;
          if (th_arc < 0 && sweep === 1)
          {
            th_arc += 2*Math.PI;
          }
          else if (th_arc > 0 && sweep === 0)
          {
            th_arc -= 2 * Math.PI;
          }
          segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)));
          for (i=0; i<segments; i++)
          {
            th2 = th0 + i * th_arc / segments;
            th3 = th0 + (i+1) * th_arc / segments;
            seg = segmentToBezier(xc, yc, th2, th3, rx, ry, sin_th, cos_th);
            tidySeg = seg.map(roundZeros);
            result.push(tidySeg);
          }

          return result;
        },
        /*===============================================
         *
         * svgProtocol object defining each command
         * with methods to convert to Cgo2D for both
         * cartesian and SVG coordinate systems
         *
         *==============================================*/
        svgProtocol = {
          "M": {
            canvasMethod: "moveTo",
            parmCount: 2,
            extCmd: "L",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),  // uppercase command means absolute coords
                  x = curr[1],
                  y = curr[2],
                  currAbs;
              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var x = curr[1],
                  y = curr[2];

              acc.px = x;  // update the pen position for next command
              acc.py = y;
              acc.push(curr); // push the curr, "M" is a Cango internal command
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var x = curr[1],
                  y = curr[2];

              x += xOfs;
              y += yOfs;
              return ["M", x, y];   // invert y coords to make Cgo2D format
            },
            invertCoords: function(curr){
              var x = curr[1],
                  y = curr[2];

              return ["M", x, -y];   // invert y coords to make Cgo2D format
            }
          },
          "L": {
            canvasMethod: "lineTo",
            parmCount: 2,
            extCmd: "L",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),  // uppercase command means absolute coords
                  x = curr[1],
                  y = curr[2],
                  currAbs;
              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var x = curr[1],
                  y = curr[2];

              acc.px = x;  // update the pen position for next command
              acc.py = y;
              acc.push(curr); // push the curr, "L" is a Cango internal command
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var x = curr[1],
                  y = curr[2];

              x += xOfs;
              y += yOfs;
              return ["L", x, y];   // invert y coords to make Cgo2D format
            },
            invertCoords: function(curr){
              var x = curr[1],
                  y = curr[2];

              return ["L", x, -y];   // invert y coords to make Cgo2D format
            }
          },
          "H": {
            parmCount: 1,
            extCmd: "H",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),   // uppercase command means absolute coords
                  x = curr[1],
                  currAbs;
              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                x += acc.px;
              }
              currAbs = [cmd, x];
              acc.px = x;        // save the new pen position
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var x = curr[1],
                  y = acc.py,
                  cangoVer = ["L", x, y];

              acc.px = x;        // save the new pen position
              acc.push(cangoVer);
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var x = curr[1];

              x += xOfs;
              return ["H", x];
            },
            invertCoords: function(curr){
              var x = curr[1];

              return ["H", x];
            }
          },
          "V": {
            parmCount: 1,
            extCmd: "V",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),   // uppercase command means absolute coords
                  y = curr[1],
                  currAbs;
              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                y += acc.py;
              }
              currAbs = [cmd, y];
              acc.py = y;        // save the new pen position
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var x = acc.px,
                  y = curr[1],
                  cangoVer = ["L", x, y];

              acc.py = y;        // save the new pen position
              acc.push(cangoVer);
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var y = curr[1];

              y += yOfs;
              return ["V", y];    // invert y coords to make Cgo2D format
            },
            invertCoords: function(curr){
              var y = curr[1];

              return ["V", -y];    // invert y coords to make Cgo2D format
            }
          },
          "C": {       // Cubic Bezier curve
            canvasMethod: "bezierCurveTo",
            parmCount: 6,
            extCmd: "C",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),  // uppercase command means absolute coords
                  c1x = curr[1],
                  c1y = curr[2],
                  c2x = curr[3],
                  c2y = curr[4],
                  x = curr[5],
                  y = curr[6],
                  currAbs;
              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                c1x += acc.px;
                c1y += acc.py;
                c2x += acc.px;
                c2y += acc.py;
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, c1x, c1y, c2x, c2y, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var x = curr[5],
                  y = curr[6];

              acc.px = x;  // update the pen position for next command
              acc.py = y;
              acc.push(curr); // push the curr, "C" is a Cango internal command
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var c1x = curr[1],
                  c1y = curr[2],
                  c2x = curr[3],
                  c2y = curr[4],
                  x = curr[5],
                  y = curr[6];

                c1x += xOfs;
                c1y += yOfs;
                c2x += xOfs;
                c2y += yOfs;
                x += xOfs;
                y += yOfs;
              return ["C", c1x, c1y, c2x, c2y, x, y]; // invert y coords
            },
            invertCoords: function(curr){
              var c1x = curr[1],
                  c1y = curr[2],
                  c2x = curr[3],
                  c2y = curr[4],
                  x = curr[5],
                  y = curr[6];

              return ["C", c1x, -c1y, c2x, -c2y, x, -y]; // invert y coords
            }
          },
          "S": {         // Smooth cubic Bezier curve
            parmCount: 4,
            extCmd: "S",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),  // uppercase means absolute coords
                  c2x = curr[1],
                  c2y = curr[2],
                  x = curr[3],
                  y = curr[4],
                  currAbs;

              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                c2x += acc.px;
                c2y += acc.py;
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, c2x, c2y, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr, idx) {
              var c1x = 0,    // relative coords of first (mirrored) control point
                  c1y = 0,
                  c2x = curr[1],
                  c2y = curr[2],
                  x = curr[3],
                  y = curr[4],
                  prevSeg = acc[idx-1],
                  cangoVer;

              // if prev segment was a cubic Bezier, mirror its last control point as cp1
              if (prevSeg[0] === "C")              {
                c1x = acc.px - prevSeg[prevSeg.length-4];   // relative coords of cp1
                c1y = acc.py - prevSeg[prevSeg.length-3];
              }
              // make cp1 absolute (all the curr coords are already absolute)
              c1x += acc.px;
              c1y += acc.py;
              cangoVer = ["C", c1x, c1y, c2x, c2y, x, y];  // Cubic Bezier
              acc.px = x;  // update the pen position for next command
              acc.py = y;
              acc.push(cangoVer);
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var c2x = curr[1],
                  c2y = curr[2],
                  x = curr[3],
                  y = curr[4];

              c2x += xOfs;
              c2y += yOfs;
              x += xOfs;
              y += yOfs;
              return ["S", c2x, c2y, x, y];    // invert y coords to make Cgo2D format
            },
            invertCoords: function(curr){
              var c2x = curr[1],
                  c2y = curr[2],
                  x = curr[3],
                  y = curr[4];

              return ["S", c2x, -c2y, x, -y];    // invert y coords to make Cgo2D format
            }
          },
          "Q": {         // Quadratic Bezier curve
            canvasMethod: "quadraticCurveTo",
            parmCount: 4,
            extCmd: "Q",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),  // uppercase command means absolute coords
                  c1x = curr[1],
                  c1y = curr[2],
                  x = curr[3],
                  y = curr[4],
                  currAbs;
              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                c1x += acc.px;
                c1y += acc.py;
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, c1x, c1y, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var x = curr[3],
                  y = curr[4];

              acc.px = x;  // update the pen position for next command
              acc.py = y;
              acc.push(curr); // push the curr, "Q" is a Cango internal command
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var c1x = curr[1],
                  c1y = curr[2],
                  x = curr[3],
                  y = curr[4];

              c1x += xOfs;
              c1y += yOfs;
              x += xOfs;
              y += yOfs;
              return ["Q", c1x, c1y, x, y];    // invert y coords to make Cgo2D format
            },
            invertCoords: function(curr){
              var c1x = curr[1],
                  c1y = curr[2],
                  x = curr[3],
                  y = curr[4];

              return ["Q", c1x, -c1y, x, -y];    // invert y coords to make Cgo2D format
            }
          },
          "T": {         // Smooth Quadratic Bezier curve
            parmCount: 2,
            extCmd: "T",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),  // uppercase means absolute coords
                  x = curr[1],
                  y = curr[2],
                  currAbs;

              // Check if 'curr' was a relative (lowercase) command
              if (cmd !== curr[0]) {
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr, idx) {
              var c1x = 0,    // relative coords of first (mirrored) control point
                  c1y = 0,
                  x = curr[1],
                  y = curr[2],
                  prevSeg = acc[idx-1],
                  cangoVer;

              // if prev segment was quadratic Bezier, mirror its last control point as cp1
              if (prevSeg[0] === "Q")            {
                c1x = acc.px - prevSeg[prevSeg.length-4];   // relative coords of first cp1
                c1y = acc.py - prevSeg[prevSeg.length-3];
              }
              // make cp1 absolute
              c1x += acc.px;
              c1y += acc.py;
              cangoVer = ["Q", c1x, c1y, x, y];   // Quadratic Bezier
              acc.px = x;  // update the pen position for next command
              acc.py = y;
              acc.push(cangoVer);
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var x = curr[1],
                  y = curr[2];

              x += xOfs;
              y += yOfs;
              return ["T", x, y];    // invert y coords to make Cgo2D format
            },
            invertCoords: function(curr){
              var x = curr[1],
                  y = curr[2];

              return ["T", x, -y];    // invert y coords to make Cgo2D format
            }
          },
          "A" : {      // Circular arc
            parmCount: 7,
            extCmd: "A",
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),
                  rx = curr[1],
                  ry = curr[2],
                  xrot = curr[3],     // opposite to SVG in Cartesian coords
                  lrg = curr[4],
                  swp = curr[5],      // opposite to SVG in Cartesian coords
                  x = curr[6],
                  y = curr[7],
                  currAbs;
              // Check if current is a relative (lowercase) command
              if (cmd !== curr[0]) {
                x += acc.px;
                y += acc.py;
              }
              currAbs = [cmd, rx, ry, xrot, lrg, swp, x, y];
              acc.px = x;
              acc.py = y;
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              var rx = curr[1],
                  ry = curr[2],
                  xrot = curr[3],     // opposite to SVG in Cartesian coords
                  lrg = curr[4],
                  swp = curr[5],      // opposite to SVG in Cartesian coords
                  x = curr[6],
                  y = curr[7],
                  sectors;

              // convert to (maybe multiple) cubic Bezier curves
              sectors = arcToBezier(acc.px, acc.py, rx, ry, xrot, lrg, swp, x, y);
              // sectors is an array of arrays of Cubic Bezier coords,
              // make a 'C' command from each sector and push it out
              sectors.forEach(function(coordAry){
                acc.push(["C"].concat(coordAry));
              });

              acc.px = x;  // update the pen position for next command
              acc.py = y;
            },
            addXYoffset: function(curr, xOfs, yOfs){
              var rx = curr[1],
                  ry = curr[2],
                  xrot = curr[3],
                  lrg = curr[4],
                  swp = curr[5],
                  x = curr[6],
                  y = curr[7];

              x += xOfs;
              y += yOfs;
              return ["A", rx, ry, xrot, lrg, swp, x, y];  // invert y coords
            },
            invertCoords: function(curr){
              var rx = curr[1],
                  ry = curr[2],
                  xrot = curr[3],
                  lrg = curr[4],
                  swp = curr[5],
                  x = curr[6],
                  y = curr[7];

              return ["A", rx, ry, -xrot, lrg, 1-swp, x, -y];  // invert coords
            }
          },
          "Z": {
            canvasMethod: "closePath",
            parmCount: 0,
            toAbs: function(acc, curr) {
              var cmd = curr[0].toUpperCase(),
                  currAbs = [cmd];
              // leave pen position where it is in case of multi-segment path
              return currAbs;
            },
            toCangoVersion: function(acc, curr) {
              // leave pen position where it is in case of multi-segment path
              acc.push(curr); // push the curr, "Z", its a Cango internal command
            },
            addXYoffset: function(curr, xOfs, yOfs){
              return ["Z"];
            },
            invertCoords: function(curr){
              return ["Z"];
            }
          }
        };
    // ========= end of vars =========

    /*==================================================
     * svgCmdCheck (a function for use with Array.reduce)
     * -------------------------------------------------
     * Checks each element, if a string it must be
     * one of the keys in the SVG proptocol. If no bad
     * cmds found then the array is returned without
     * alteration, if not an empty array is returned.
     *=================================================*/
    function svgCmdCheck(acc, current, idx)
    {
      // make a concession to SVG standard and allow all number array
      if (idx === 0)
      {
        if (typeof current !== 'string')
        {
          acc.push("M");
          // now we will fall through to normal checking
        }
      }
      // if we see a command string, check it is in SVG protocol
      if (typeof current === "string") {  // check each string element
        if (!svgProtocol.hasOwnProperty(current.toUpperCase()))
        {
          console.log("unknown command string '"+current+"'");
          acc.badCmdFound = true;
          acc.length = 0;   // any bad command will force e,pty array to be retruned
        }
      }
      if (!acc.badCmdFound)
      {
        acc.push(current);
      }
      // always return when using reduce...
      return acc;
    }

    /*======================================================
     * unExtend  (a function for use with Array.reduce)
     * -----------------------------------------------------
     * Undo the extension of commands given the svg protocol.
     * Each entry in the protocol has an extCmd property which
     * is usually the same as the command key but for "M"
     * which may be extended by a series of "L" commands.
     * Extending a command means that multiple sets of paramaeters
     * may follow a command letter without the need to repeat
     * the command letter in front of each set eg.
     * The 'reduce' accumulator is used to hold the current
     * command as a property (not an array element) and make it
     * available to the next element.
     *
     * var a = ['M', 1, 2, 'L', 3, 4, 5, 6, 7, 8, 'A', 5, 6, 7, 8, 3, 0, 2]
     * var b = a.reduce(unExtend, [])
     *
     * >> ['M', 1, 2, 'L', 3, 4, 'L', 5, 6, 'L', 7, 8, 'A', 5, 6, 7, 8, 3, 0, 2]
     *
     * This assumes no invalid commands are in the string -
     * so array should be sanitized before running unExtend
     *======================================================*/
    function unExtend(acc, current, idx, ary)
    {
      var newCmd;

      if (idx === 0)
      {
        acc.nextCmdPos = 0;  // set expected position of next command string as first element
      }
      // Check if current is a command in the protocol (protocol only indexed by upperCase)
      if (typeof current === 'string')
      {
        if (idx < acc.nextCmdPos)
        {
          // we need another number but found a string
          console.log("bad number of parameters for '"+current+"' at index "+idx);
          acc.badParameter = true;  // raise flag to bailout processing this
          acc.push(0);  // try to get out without crashing (acc data will be ditched any way)
          return acc;
        }
        // its a command the protocol knows, remember it across iterations of elements
        acc.currCmd = current.toUpperCase();  // save as a property of the acc Array object (not an Array element)
        acc.uc = (current.toUpperCase() === current);  // upperCase? true or false
        // calculate where the next command should be
        acc.nextCmdPos = idx + svgProtocol[acc.currCmd].parmCount + 1;
        acc.push(current);
      }
      else if (idx < acc.nextCmdPos)   // processing parameters
      {
        // keep shoving parameters
        acc.push(current);
      }
      else
      {
        // we have got a full set of paramaters but hit another number
        // instead of a command string, it must be a command extention
        // push a the extension command (same as current except for M which extend to L)
        // into the accumulator
        acc.currCmd = svgProtocol[acc.currCmd].extCmd;  // NB: don't change the acc.uc boolean
        newCmd = (acc.uc)? acc.currCmd: acc.currCmd.toLowerCase();
        acc.push(newCmd, current);
        // calculate where the next command should be
        acc.nextCmdPos = idx + svgProtocol[acc.currCmd].parmCount;
      }

      if (idx === ary.length-1)   // done processing check if all was ok
      {
        if (acc.badParameter)
        {
          acc.length = 0;
        }
      }
      // always return when using reduce...
      return acc;
    }

    /*==================================================
     * svgCmdSplitter (a function for use with Array.reduce)
     * -------------------------------------------------
     * Split an array on a string type element, e.g.
     *
     * var a = ['a', 1, 2, 'b', 3, 4, 'c', 5, 6, 7, 8]
     * var b = a.reduce(svgCmdSplitter, [])
     *
     * >> [['a', 1, 2],['b', 3, 4], ['c', 5, 6, 7, 8]]
     *
     *=================================================*/
    function svgCmdSplitter(acc, curr)
    {
      // if we see a command string, start a new array element
      if (typeof curr === "string") {
          acc.push([]);
      }
      // add this element to the back of the acc's last array
      acc[acc.length-1].push(curr);
      // always return when using reduce...
      return acc;
    }

    /*===========================================================
     * toAbsoluteCoords  (a function for use with Array.reduce)
     * ----------------------------------------------------------
     * Reduce is needed even though the same size elements are
     * returned because the accumulator is used to hold the pen
     * x,y coords and make them available to the next element.
     * Assumes 'current' argument is an array of form ["M", 2, 7]
     * if command letter is lower case the protocol.toAbs
     * function will add the current pen x and y values to
     * the coordinates and update the pen x, y. The
     * absolute coord version of the cmd and its coords will
     * be returned and then pushed into acc.
     *
     * eg. ['M', 1, 2, 'l', 3, 4, 'a', 5, 6, 7, 8, 3, 0, 2, 'z']
     * >>  ['M', 1, 2, 'L', 4, 6, 'A', 5, 6, 7, 8, 3, 4, 8, 'Z']
     *===========================================================*/
    function toAbsoluteCoords(acc, current, idx)
    {
      var currCmd, currAbs;

      if (acc.px === undefined)
      {
        acc.px = 0;
        acc.py = 0;
      }
      // get protocol object for this command, indexed by uppercase only
      currCmd = svgProtocol[current[0].toUpperCase()];
      // call protocol toAbs function for this command
      // it returns absolute coordinate version based on current
      // pen position stored in acc.px, acc.py
      currAbs = currCmd.toAbs(acc, current, idx);
      acc.push(currAbs);
      // always return when using reduce...
      return acc;
    }

    /*==================================================================================
     * toCangoCmdSet  (a function for use with Array.reduce)
     * ---------------------------------------------------------------------------------
     * Assumes 'current' argument is an array of form ["M", 2, 7]
     * All commands letters are uppercase and all coordinates
     * are absolute (referenced to world coordinate origin).
     * This function will convert "H", "V", "S", "T", and "A"
     * commands to Cango internal command set "M", "L", "Q", "C", "Z"
     * All coordinates will be returned in separate array
     *
     * eg. [['M', 1, 2], ['L', 3, 4], ['H', 3], ['A', 5, 6, 7, 8, 3, 0, 2], ['Z']]
     * >>  [['M', 1, 2], ['L', 3, 4], ['L', 3, 4], ['C', cp, cp, cp, cp, x, y], ['Z']]
     *==================================================================================*/
    function toCangoCmdSet(acc, current, idx)
    {
      var currCmd = current[0],
          currSvgObj = svgProtocol[currCmd];

      // call protocol toCangoVersion function for this command
      // it converts all SVG to just "M", "L", "Q", "C", "Z" command and coords
      // and pushes them into the acc
      currSvgObj.toCangoVersion(acc, current, idx);
      // always return when using reduce...
      return acc;
    }

    /*==============================================
     * toDrawCmds  (a function for use with Array.reduce)
     * ----------------------------------------------
     * Convert a Cgo2D data array to an array
     * of Cango DrawCmd objects e.g.
     *
     * [['M', 0.1, 0.2], ['L', 1, 2], ['C', 3, 4, 5, 6, 2, 9], ['Z']]
     *
     * will become
     * [{ drawFn: "moveTo",
     *    parmsWC: [[0.1, 0.2]],
     *    ...
     *  },
     *  { drawFn: "bezierCurveTo",
     *    parmsWC: [[3,4], [5,6], [2, 9]]
     *    ...
     *  },
     *  ...
     *  ]
     *
     *===============================================*/
    function toDrawCmds(current)
    {
      // first element is a command...
      var cmd = current[0],   // grab command string
          parameters = current.slice(1); // make an array of the rest

      // the array elements have been checked as all valid
      // make a new element starting with an empty array
      return new DrawCmd(svgProtocol[cmd].canvasMethod, parameters);
    }

    /*==================================================
     * strToCgo2D (a function for use with Array.reduce)
     * -------------------------------------------------
     * Assumes 'current' argument is a string of form
     * "M  2 7" or "v 7  " or "z" which always has a
     * command string as the first character
     * and the rest is numbers separated by white space
     * This function will reduce (combine) to a single
     * array in Cgo2D format ["M", 2, 7, "v", 7, "z"]
     *=================================================*/
    function strToCgo2D(acc, current)
    {
      var tokens,
          numberStrs;

      tokens = current.match(/([a-z]+|-?[.\d]*\d)/gi);
      acc.push(tokens[0]);
      numberStrs = tokens.slice(1);
      // convert to an array of strings, each one number
      if (numberStrs)      // z has no numbers to follow
      {
        // we have an array of strings ["3","4","5", "-6","7"]
        // parse each to a float and push it into acc
        numberStrs.forEach(function(s){
          var num = parseFloat(s);
          if (!isNaN(num))
          {
            acc.push(num);
          }
        });
      }
      // always return when using reduce...
      return acc;
    }

    /*===========================================================
     * flipCoords  (a function for use with Array.map)
     * ----------------------------------------------------------
     * Assumes 'current' argument is an array of form ["M", 2, 7]
     * All coordinates will be be in absolute format
     * The protocol will have an 'invertCoords' method for each
     * possible command key this will return the current array
     * with the sign of the Y coords flipped and sense of arcs reversed
     * reversed
     *
     * current = ['A', 2, 2,  30, 0, 1, 3,  4]
     *       >>  ['A', 2, 2, -30, 0, 0, 3, -4]
     *===========================================================*/
    function flipCoords(current)
    {
      var currCmd = current[0],
          currSvgObj = svgProtocol[currCmd];

      // call protocol.invertCoords function for this command
      // it flips the sign of the y coords, for 'A' commands it flips
      // sweep and xRotation values and returns the modified array
      return currSvgObj.invertCoords(current);
    }

    /*===========================================================
     * translateOrigin  (a function for use with Array.map)
     * ----------------------------------------------------------
     * Assumes it is called with 'this' object having
     * properties {xOfs: value, yOfs: value}
     * Assumes 'current' argument is an array of form ["M", 2, 7]
     * All coordinates will be be in absolute format
     * The protocol will have an 'addXYoffset method for each
     * possible command key this will return the current array
     * with the X and Y offsets added to the coordinate elements.
     *
     * eg. if 'this = {xOfs: 100, yOfs: 10}
     * current = ['M', 1, 2]
     * >>  ['M', 101, 12]
     *===========================================================*/
    function translateOrigin(current)
    {
      var currCmd = current[0],
          currSvgObj = svgProtocol[currCmd],
          xofs = this.xOfs || 0,
          yofs = this.yOfs || 0;

      return currSvgObj.addXYoffset(current, xofs, yofs);
    }

    /*===========================================================
     * flatten2Dary  (a function for use with Array.reduce)
     * ----------------------------------------------------------
     * Assumes curr is an array, push each element into the acc
     * to form a 1D array.

     * eg. [['M', 1, 2], ['V',2],['Z']]
     * >>  ['M', 1, 2, 'V', 2, 'Z']
     *===========================================================*/
    function flatten2Dary(acc, curr){
      return acc.concat(curr);
    }

    /*===========================================================
     * flattenDrawCmds  (a function for use with Array.reduce)
     * ----------------------------------------------------------
     * Assumes curr is an array, push each element into the acc
     * to form a 1D array.

     * eg. [{drawFn:'moveTo', parmsWC:[[1, 2]], {drawFn:'lineTo', parmsWC:[[3,4]]}, {drawFn:'closePath', parmsWC:[]}]
     * >>  ['M', 1, 2, 'L', 3, 4, 'Z']
     *===========================================================*/
    function flattenDrawCmds(acc, curr){
    // NEED TO map 'moveTo' to 'M' etc
      var cvsTocgo2D = {"moveTo":"M",
                        "lineTo":"L",
                        "bezierCurveTo":"C",
                        "quadraticCurveTo":"Q",
                        "closePath":"Z"};

      acc.push(cvsTocgo2D[curr.drawFn]);
      curr.parmsWC.forEach(function(coordAry){
        coordAry.forEach(function(coord){
          acc.push(coord);
        });
      });
      return acc;
    }

    // auto run this code to create this object holding the two translator fns
    // and return it as the svgParser
    return {
      svg2cgo2D: function(svgStr, xShft, yShft) {
        var dx = xShft || 0,
            dy = yShft || 0,
            newPath,
            cmdStrs;

        if ((typeof svgStr !== 'string')||(svgStr.length === 0))
        {
          return [];
        }
        newPath = svgStr.replace(/([zZ])(?=.)/g, "$1 ");  // patch to catch "zM" in svg
        // this SVG path data split it at command chars
        cmdStrs = newPath.match(/([a-df-z]+[-.,\d ]*)/gi);  // avoid e in exponents

        return cmdStrs.reduce(strToCgo2D, [])
                      .reduce(svgCmdCheck, [])
                      .reduce(unExtend, [])
                      .reduce(svgCmdSplitter, [])
                      .reduce(toAbsoluteCoords, [])
                      .map(translateOrigin, {xOfs: dx, yOfs: dy})
                      .map(flipCoords)
                      .reduce(flatten2Dary, []);
      },

      drawcmds2cgo: function(dCmds) {
        return dCmds.reduce(flattenDrawCmds, []);
      },

      cgo2drawcmds: function(cgo2Dary) {
        if (!Array.isArray(cgo2Dary) || (cgo2Dary.length === 0))
        {
          return [];
        }
        return cgo2Dary.reduce(svgCmdCheck, [])
                       .reduce(unExtend, [])
                       .reduce(svgCmdSplitter, [])
                       .reduce(toAbsoluteCoords, [])
                       .reduce(toCangoCmdSet, [])     // output array = [['M',x,y], ['c',px,py, qx,qy, ux,uy]...]
                       .map(toDrawCmds);              // output array = [{drawFn:'moveTo',parmsWC:[[x,y]]}, {} ...]
      },

      svg2drawcmds: function(svgStr) {
        var noCommas,
            cmdStrs,
            cgo2Dary;

        if ((typeof svgStr !== 'string')||(svgStr.length === 0))
        {
          return "";
        }
        // this SVG processor can handle comma separated or whitespace separated or mixed
        // replace any commas with spaces
        noCommas = svgStr.replace(new RegExp(',', 'g'), ' ');
        // now we have a string of commands and numbers separated by whitespace
        // split it at command chars
        cmdStrs = noCommas.split(/(?=[a-df-z])/i);  // avoid e in exponents

        cgo2Dary = cmdStrs.reduce(strToCgo2D, [])
                          .reduce(svgCmdCheck, [])
                          .reduce(unExtend, [])
                          .reduce(svgCmdSplitter, [])
                          .reduce(toAbsoluteCoords, [])
                          .reduce(toCangoCmdSet, [])
                          .map(toDrawCmds);
        return cgo2Dary;
      }
    };

  }());

  svgToDrawCmds = svgParser.svg2drawcmds;
  cgo2DToDrawCmds = svgParser.cgo2drawcmds;
  drawCmdsToCgo2D = svgParser.drawcmds2cgo;
  svgToCgo2D = svgParser.svg2cgo2D;

  if (shapeDefs === undefined)
  {
    shapeDefs = {'circle': function(diameter){
                            var d = diameter || 1;
                            return ["m", -0.5*d,0,
                            "c", 0,-0.27614*d, 0.22386*d,-0.5*d, 0.5*d,-0.5*d,
                            "c", 0.27614*d,0, 0.5*d,0.22386*d, 0.5*d,0.5*d,
                            "c", 0,0.27614*d, -0.22386*d,0.5*d, -0.5*d,0.5*d,
                            "c", -0.27614*d,0, -0.5*d,-0.22386*d, -0.5*d,-0.5*d, "z"];},

                'ellipse': function(width, height){
                            var w = width || 1,
                                h = w;
                            if ((typeof height === 'number')&&(height>0))
                            {
                              h = height;
                            }
                            return ["m", -0.5*w,0,
                            "c", 0,-0.27614*h, 0.22386*w,-0.5*h, 0.5*w,-0.5*h,
                            "c", 0.27614*w,0, 0.5*w,0.22386*h, 0.5*w,0.5*h,
                            "c", 0,0.27614*h, -0.22386*w,0.5*h, -0.5*w,0.5*h,
                            "c", -0.27614*w,0, -0.5*w,-0.22386*h, -0.5*w,-0.5*h, "z"];},

                'square': function(width){
                            var w = width || 1;
                            return ["m", 0.5*w, -0.5*w, "l", 0, w, -w, 0, 0, -w, "z"];},

                'rectangle': function(width, height, rad){
                            var w = width || 1;
                            var h = height || w;
                            var r;
                            if ((rad === undefined)||(rad<=0))
                            {
                              return ["m",-w/2,-h/2, "l",w,0, 0,h, -w,0, "z"];
                            }
                            r = Math.min(w/2, h/2, rad);
                            return ["m", -w/2+r,-h/2, "l",w-2*r,0, "a",r,r,0,0,1,r,r, "l",0,h-2*r,
                                    "a",r,r,0,0,1,-r,r, "l",-w+2*r,0, "a",r,r,0,0,1,-r,-r, "l",0,-h+2*r,
                                    "a",r,r,0,0,1,r,-r, "z"];},

                'triangle': function(side){
                            var s = side || 1;
                            return ["m", 0.5*s, -0.289*s, "l", -0.5*s, 0.866*s, -0.5*s, -0.866*s, "z"];},

                'cross': function(width){
                            var w = width || 1;
                            return ["m", -0.5*w, 0, "l", w, 0, "m", -0.5*w, -0.5*w, "l", 0, w];},

                'ex': function(diagonal){
                            var d = diagonal || 1;
                            return ["m", -0.3535*d,-0.3535*d, "l",0.707*d,0.707*d,
                                    "m",-0.707*d,0, "l",0.707*d,-0.707*d];}
                };
  }

  function Drag2D(grabFn, dragFn, dropFn)
  {
    var savThis = this,
        nLrs, topCvs;

    this.cgo = null;                    // filled in by render
    this.layer = null;                  // filled in by render
    this.target = null;                 // filled by enableDrag method
    this.grabCallback = grabFn || null;
    this.dragCallback = dragFn || null;
    this.dropCallback = dropFn || null;
    this.grabCsrPos = {x:0, y:0};
    this.dwgOrg = {x:0, y:0};           // target drawing origin in world coords
    this.grabOfs = {x:0, y:0};          // csr offset from target (maybe Obj or Group) drawing origin
    // the following closures hold the scope of the Drag2D instance so 'this' points to the Drag2D
    // multiple Obj2D may use this Drag2D, hitTest passes back which it was
    this.grab = function(evt)
    {
      var event = evt||window.event,
          csrPosWC;

      // calc top canvas at grab time since layers can come and go
      nLrs = this.cgo.bkgCanvas.layers.length;
      topCvs = this.cgo.bkgCanvas.layers[nLrs-1].cElem;

      topCvs.onmouseup = function(e){savThis.drop(e);};
      topCvs.onmouseout = function(e){savThis.drop(e);};
      csrPosWC = this.cgo.getCursorPosWC(event);      // update mouse pos to pass to the owner
      // save the cursor pos its very useful
      this.grabCsrPos.x = csrPosWC.x;
      this.grabCsrPos.y = csrPosWC.y;
      // copy the parent drawing origin (for convenience)
      this.dwgOrg.x = this.target.dwgOrg.x;
      this.dwgOrg.y = this.target.dwgOrg.y;
      if (this.target.parent)
      {
        // save the cursor offset from the drawing origin (world coords) add any parent Group offset
        this.grabOfs = {x:csrPosWC.x - this.dwgOrg.x + this.target.parent.dwgOrg.x,
                        y:csrPosWC.y - this.dwgOrg.y + this.target.parent.dwgOrg.y};
      }
      else
      {
        // no parent, so same as adding 0s
        this.grabOfs = {x:csrPosWC.x - this.dwgOrg.x,
                        y:csrPosWC.y - this.dwgOrg.y};
      }

      if (this.grabCallback)
      {
        this.grabCallback(csrPosWC);    // call in the scope of dragNdrop object
      }

      topCvs.onmousemove = function(event){savThis.drag(event);};
      if (event.preventDefault)       // prevent default browser action (W3C)
      {
        event.preventDefault();
      }
      else                        // shortcut for stopping the browser action in IE
      {
        window.event.returnValue = false;
      }
      return false;
    };

    this.drag = function(event)
    {
      var csrPosWC;
      if (this.dragCallback)
      {
        csrPosWC = this.cgo.getCursorPosWC(event);  // update mouse pos to pass to the owner
        window.requestAnimationFrame(function(){savThis.dragCallback(csrPosWC);});
      }
    };

    this.drop = function(event)
    {
      var csrPosWC = this.cgo.getCursorPosWC(event);  // update mouse pos to pass to the owner
      topCvs.onmouseup = null;
      topCvs.onmouseout = null;
      topCvs.onmousemove = null;
      if (this.dropCallback)
      {
        this.dropCallback(csrPosWC);
      }
    };

    // version of drop that can be called from an app to stop a drag before the mouseup event
    this.cancelDrag = function(mousePos)
    {
      topCvs.onmouseup = null;
      topCvs.onmouseout = null;
      topCvs.onmousemove = null;
      if (this.dropCallback)
      {
        this.dropCallback(mousePos);
      }
    };
  }

  LinearGradient = function(p1x, p1y, p2x, p2y)
  {
    this.grad = [p1x, p1y, p2x, p2y];
    this.colorStops = [];
    this.addColorStop = function(){this.colorStops.push(arguments);};
  };

  RadialGradient = function(p1x, p1y, r1, p2x, p2y, r2)
  {
    this.grad = [p1x, p1y, r1, p2x, p2y, r2];
    this.colorStops = [];
    this.addColorStop = function(){this.colorStops.push(arguments);};
  };

  Tweener = function(delay, duration, loopStr)  // interpolates between values held in an array
  {
		this.delay = delay || 0;
    this.dur = duration || 5000;
    this.reStartOfs = 0;
    this.loop = false;
    this.loopAll = false;

    var savThis = this,
        loopParm = "noloop";

    if (typeof loopStr === 'string')
    {
      loopParm = loopStr.toLowerCase();
    }
    if (loopParm === 'loop')
    {
      this.loop = true;
    }
    else if (loopParm === 'loopall')
    {
      this.loopAll = true;
    }

    this.getVal = function(time, vals, keyTimes)  // vals is an array of key frame values (or a static number)
    {
      var numSlabs, slabDur, slab, frac, i,
					t = 0,
					tFrac,
					localTime,
					values, times;

      if (time === 0)       // re-starting after a stop, otherwise this can increase forever (looping is handled here)
      {
        savThis.reStartOfs = 0;     // reset this to prevent negative times
      }
      localTime = time - savThis.reStartOfs;       // handles local looping
      if ((localTime > savThis.dur+savThis.delay) && (savThis.dur > 0) && (savThis.loop || savThis.loopAll))
      {
        savThis.reStartOfs = savThis.loop? time - savThis.delay : time;      // we will correct external time to re-start
        localTime = 0;          // force re-start at frame 0 now too
      }
      t = 0;    // t is the actual local time value used for interpolating
      if (localTime > savThis.delay)    // repeat initial frame (t=0) if there is a delay to start
      {
        t = localTime - savThis.delay;   // localTime is contrained to 0 < localTime < this.dur
      }

      if (!Array.isArray(vals))    // not an array, just a static value, return it every time
      {
        return vals;
      }
      if (!vals.length)
      {
        return 0;
      }
      if (vals.length === 1)
      {
        return vals[0];
      }
      // we have at least 2 element array of values
      if (t === 0)
      {
        return vals[0];
      }
      if (t >= savThis.dur)
      {
        return vals[vals.length-1];  // freeze at end value
      }
      numSlabs = vals.length-1;
      if (!Array.isArray(keyTimes) || (vals.length !== keyTimes.length))
      {
        slabDur = savThis.dur/numSlabs;
        slab = Math.floor(t/slabDur);
        frac = (t - slab*slabDur)/slabDur;

        return vals[slab] + frac*(vals[slab+1] - vals[slab]);
      }

      // we have keyTimes to play work with copies of arrays
      values = [].concat(vals);
      times = [].concat(keyTimes);
      // make sure times start with 0
      if (times[0] !== 0)
      {
        values.unshift(values[0]);
        times.unshift(0);
      }
      // make sure times end with 100
      if (times[times.length-1] !== 100)
      {
        values.push(values[values.length-1]);
        times.push(100);
      }
      i = 0;
      tFrac = t/savThis.dur;
      while ((i < times.length-1) && (times[i+1]/100 < tFrac))
      {
        i++;
      }
      slabDur = (times[i+1]-times[i])/100;
      frac = (tFrac - times[i]/100)/slabDur;    // convert percentage time to fraction

      return values[i] + frac*(values[i+1] - values[i]);
    };
  };

  function transformPoint(px, py, m)
  {
    return {x:px*m.a + py*m.c + m.e, y:px*m.b + py*m.d + m.f};
  }

  function matrixReset(m)
  { // reset to the identity matrix
    m.a = 1;
    m.b = 0;
    m.c = 0;
    m.d = 1;
    m.e = 0;
    m.f = 0;
  }

  function translater(args)      // will be called with 'this' pointing to an Obj2D
  {
    var x = args[0] || 0,
        y = args[1] || 0;

    if (this.hasOwnProperty('type'))    // this transformer may be called on point object {x:, y: }
    {
      this.ofsTfm = this.ofsTfm.translate(x, y);   
    }
    else     // its a point to be transformed
    {
      return {x:this.x + x, y:this.y + y};  // transformPoint returns an Object {x:, y: }
    }
  }

  function skewer(args)
  {
    // Skew matrix, angles in degrees applied before translate or revolve
    var ha = args[0] || 0,
        va = args[1] || 0,
        rad = Math.PI/180.0,
				htn	= Math.tan(-ha*rad),
				vtn	= Math.tan(va*rad);

    if (this.hasOwnProperty('type'))    // this transformer may be called on point object {x:, y: }
    {
      this.ofsTfm = this.ofsTfm.skewX(ha*rad);
      this.ofsTfm = this.ofsTfm.skewY(va*rad);
    }
    else
    {
      return {x:this.x + this.y*htn, y:this.x*vtn + this.y};  // transfromPoint returns an Object {x:, y: }
    }
  }

  function scaler(args)      // will be called with 'this' pointing to an Obj2D
  {
    // scale matrix, applied before translate or revolve
    var sx = args[0] || 1,
        sy = args[1] || sx;

    if (this.hasOwnProperty('type'))
    {
      this.ofsTfm = this.ofsTfm.scaleNonUniform(sx, sy);
    }
    else    // this transformer may be called on point object {x:, y: }
    {
      return {x:this.x*sx, y:this.y*sy};  // transfromPoint returns an Object {x:, y: }
    }
  }

  function rotater(args)      // will be called with 'this' pointing to an Obj2D or point {x:, y: }
  {
    // rotate matrix, angles in degrees applied before translate or revolve
    var angle = args[0] || 0,
        rad = Math.PI/180.0,
				s	= Math.sin(-angle*rad),
        c	= Math.cos(-angle*rad);
        
    if (this.hasOwnProperty('type'))
    {
      this.ofsTfm = this.ofsTfm.rotate(angle);
    }
    else     // this transformer may be called on point object {x:, y: }
    {
      return {x:this.x*c + this.y*s, y:-this.x*s + this.y*c};  // transfromPoint returns an Object {x:, y: }
    }
  }

  function revolver(args)      // will be called with 'this' pointing to an Obj2D or point {x:, y: }
  {
    // Rotate matrix, angles in degrees can be applied after tranlation away from World Coord origin
    var angle = args[0] || 0,
        rad = Math.PI/180.0,
				s	= Math.sin(-angle*rad),
				c	= Math.cos(-angle*rad);

    if (this.hasOwnProperty('type'))
    {
      this.ofsTfm = this.ofsTfm.rotate(angle*rad);
    }
    else  // point
    {
      return {x:this.x*c + this.y*s, y:-this.x*s + this.y*c};  // transfromPoint returns an Object {x:, y: }
    }
  }

  function Distorter(type, fn)  // and other arguments
  {
    var argAry = Array.prototype.slice.call(arguments).slice(2);     // skip type and fn parameters save the rest

    this.type = type;
    this.distortFn = fn;
    this.args = argAry;     // array of arguments
  }

  function TfmTools(obj)
  {
    var savThis = this;

    this.parent = obj;
    // container for to add transforming methods to a Group or Obj2D
    // each method adds Distorter Object to the ofsTfmAry to be applied to the Obj2D when rendered
    this.translate = function(tx, ty)
    {
      var trnsDstr = new Distorter("TRN", translater, tx, ty);
      savThis.parent.ofsTfmAry.unshift(trnsDstr);
    };
    this.scale = function(scaleX, scaleY)
    {
      var sclDstr = new Distorter("SCL", scaler, scaleX, scaleY);
      savThis.parent.ofsTfmAry.push(sclDstr);
    };
    this.rotate = function(deg)
    {
      var rotDstr = new Distorter("ROT", rotater, deg);
      savThis.parent.ofsTfmAry.push(rotDstr);
    };
    this.skew = function(degH, degV)
    {
      var skwDstr = new Distorter("SKW", skewer, degH, degV);
      savThis.parent.ofsTfmAry.push(skwDstr);
    };
    this.revolve = function(deg)
    {
      var revDstr = new Distorter("REV", revolver, deg);
      savThis.parent.ofsTfmAry.unshift(revDstr);
    };
    this.reset = function()
    {
      savThis.parent.ofsTfmAry = [];
      matrixReset(savThis.parent.ofsTfm);  // reset the accumulation matrix
    };
  }

  function HardTfmTools(obj)
  {
    var savThis = this;

    savThis.parent = obj;
    // container for to add transforming methods to a Group or Obj2D
    // each method adds Distorter Object to the hardTfmAry to be applied to the Obj2D when rendered
    this.translate = function(tx, ty)
    {
      var trnsDstr = new Distorter("TRN", translater, tx, ty);
      savThis.parent.hardTfmAry.unshift(trnsDstr);
    };
    this.scale = function(scaleX, scaleY)
    {
      var sclDstr = new Distorter("SCL", scaler, scaleX, scaleY);
      savThis.parent.hardTfmAry.unshift(sclDstr);
    };
    this.rotate = function(deg)
    {
      var rotDstr = new Distorter("ROT", rotater, deg);
      savThis.parent.hardTfmAry.unshift(rotDstr);
    };
    this.skew = function(degH, degV)
    {
      var skwDstr = new Distorter("SKW", skewer, degH, degV);
      savThis.parent.hardTfmAry.unshift(skwDstr);
    };
    this.reset = function()
    {
      savThis.parent.hardTfmAry = [];
    };
  }

  Group = function()
  {
    this.type = "GRP";                    // enum of type to instruct the render method
    this.parent = null;                   // pointer to parent group if any
    this.children = [];                   // only Groups have children
    this.ofsTfmAry = [];                  // soft offset from any parent Group's transform
    this.netTfmAry = [];                  // ofsTfmAry with grpTfmAry concatinated
    this.ofsTfm = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();  // product of hard & ofs tfm actions, filled in at render
    this.netTfm = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();  // parent Group netTfm applied to this.ofsTfm
    this.transform = new TfmTools(this);  // soft transforms (reset after render)
    this.dragNdropHandlers = null;        // array of DnD handlers to be passed to newly added children
    // add any objects passed by forwarding them to addObj
    this.addObj.apply(this, arguments);
  };

  Group.prototype.deleteObj = function(obj)
  {
    // remove from children array
    var idx = this.children.indexOf(obj);

    if (idx >= 0)
    {
      this.children.splice(idx, 1);
      obj.parent = null;
    }
  };

  Group.prototype.addObj = function()
  {
    var args = Array.prototype.slice.call(arguments), // grab array of arguments
        i, j;

    for (i=0; i<args.length; i++)
    {
      if (Array.isArray(args[i]))
      {
        // check that only Groups or Obj2Ds are passed
        for (j=0; j<args[i].length; j++)
        {
          if (args[i][j].type)
          {
            // point the Obj2D or Group parent property at this Group
            args[i][j].parent = this;           // now its a free agent link it to this group
            this.children.push(args[i][j]);
            // enable drag and drop if this group has drag
            if (!args[i][j].dragNdrop && this.dragNdropHandlers)
            {
              args[i][j].enableDrag.apply(args[i][j], this.dragNdropHandlers);
              args[i][j].dragNdrop.target = this;     // the Group is the target being dragged
            }
          }
        }
      }
      else
      {
        if (args[i] && (args[i].type))  // don't add undefined or non-Obj2D
        {
          // point the Obj2D or Group parent property at this Group
          args[i].parent = this;            // now its a free agent link it to this group
          this.children.push(args[i]);
          // enable drag and drop if this group has drag
          if (!args[i].dragNdrop && this.dragNdropHandlers)
          {
            args[i].enableDrag.apply(args[i], this.dragNdropHandlers);
            args[i].dragNdrop.target = this;     // the Group is the target being dragged
          }
        }
      }
    }
  };

  /*======================================
   * Recursively apply a hard translation
   * to all the Obj2Ds in the family tree.
   *-------------------------------------*/
  Group.prototype.translate = function(x, y)
  {
    // Apply transform to the hardOfsTfm of all Obj2D children recursively
  	function iterate(grp)
  	{
  		grp.children.forEach(function(childNode){
  		  if (childNode.type === "GRP")
        {
  			  iterate(childNode);
        }
        else
        {
          childNode.translate(x, y);
        }
  		});
  	}

    iterate(this);
  };

  /*======================================
   * Recursively apply a hard rotation
   * to all the Obj2Ds in the family tree.
   *-------------------------------------*/
  Group.prototype.rotate = function(degs)
  {
    // Apply transform to the hardOfsTfm of all Obj2D children recursively
  	function iterate(grp)
  	{
  		grp.children.forEach(function(childNode){
  		  if (childNode.type === "GRP")
        {
  			  iterate(childNode);
        }
        else
        {
          childNode.rotate(degs);
        }
  		});
  	}

    iterate(this);
  };

  /*======================================
   * Recursively apply a hard skew
   * to all the Obj2Ds in the family tree.
   *-------------------------------------*/
  Group.prototype.skew = function(degH, degV)
  {
    // Apply transform to the hardOfsTfm of all Obj2D children recursively
  	function iterate(grp)
  	{
  		grp.children.forEach(function(childNode){
  		  if (childNode.type === "GRP")
        {
  			  iterate(childNode);
        }
        else
        {
          childNode.skew(degH, degV);
        }
  		});
  	}

    iterate(this);
  };

  /*======================================
   * Recursively apply a hard scale
   * to all the Obj2Ds in the family tree.
   *-------------------------------------*/
  Group.prototype.scale = function(xsc, ysc)
  {
    var xScl = xsc,
        yScl = ysc ||xScl;

    // Apply transform to the hardOfsTfm of all Obj2D children recursively
  	function iterate(grp)
  	{
  		grp.children.forEach(function(childNode){
  		  if (childNode.type === "GRP")
        {
          iterate(childNode);
        }
        else
        {
          childNode.scale(xScl, yScl);
        }
  		});
  	}

    iterate(this);
  };

  /*======================================
   * Recursively add drag object to Obj2D
   * decendants.
   * When rendered all these Obj2D will be
   * added to dragObjects to be checked on
   * mousedown
   *-------------------------------------*/
  Group.prototype.enableDrag = function(grabFn, dragFn, dropFn)
  {
    var savThis = this;

  	function iterate(grp)
  	{
  		grp.children.forEach(function(childNode){
  		  if (childNode.type === "GRP")
        {
  		    iterate(childNode);
        }
        else   // Obj2D
        {
          if (childNode.dragNdrop === null)    // don't over-write if its already assigned a handler
          {
            childNode.enableDrag(grabFn, dragFn, dropFn);
            childNode.dragNdrop.target = savThis;     // the Group is the target being dragged
          }
        }
  		});
  	}

    this.dragNdropHandlers = arguments;
    iterate(this);
  };

  /*======================================
   * Disable dragging on Obj2D children
   *-------------------------------------*/
  Group.prototype.disableDrag = function()
  {
  	function iterate(grp)
  	{
  		grp.children.forEach(function(childNode){
  		  if (childNode.type === "GRP")
        {
  		    iterate(childNode);
        }
        else
        {
          childNode.disableDrag();
        }
  		});
  	}

    this.dragNdropHandlers = undefined;
    iterate(this);
  };

  function setPropertyFn(propertyName, value)
  {
    var lorgVals = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    if ((typeof propertyName !== "string")||(value === undefined))
    {
      return;
    }

    switch (propertyName.toLowerCase())
    {
      case "fillcolor":
        this.fillCol = value;
        break;
      case "strokecolor":
        this.strokeCol = value;
        break;
      case "linewidth":
      case "strokewidth":                 // for backward compatability
        if ((typeof value === "number")&&(value > 0))
        {
          this.lineWidth = value;
        }
        break;
      case "linewidthwc":
        if ((typeof value === "number")&&(value > 0))
        {
          this.lineWidthWC = value;
        }
        break;
      case "linecap":
        if (typeof value !== "string")
        {
          return;
        }
        if ((value === "butt")||(value ==="round")||(value === "square"))
        {
          this.lineCap = value;
        }
        break;
      case "iso":
      case "isotropic":
        if ((value == true)||(value === 'iso')||(value === 'isotropic'))
        {
          this.iso = true;
        }
        else
        {
          this.iso = false;
        }
        break;
      case "dashed":
        if (Array.isArray(value) && value[0])
        {
          this.dashed = value;
        }
        else     // ctx.setLineDash([]) will clear dashed settings
        {
          this.dashed = [];
        }
        break;
      case "dashoffset":
        this.dashOffset = value || 0;
        break;
      case "border":
        if (value === true)
        {
          this.border = true;
        }
        if (value === false)
        {
          this.border = false;
        }
        break;
      case "fontsize":
        if ((typeof value === "number")&&(value > 0))
        {
          this.fontSize = value;
        }
        break;
      case "fontweight":
        if ((typeof value === "string")||((typeof value === "number")&&(value>=100)&&(value<=900)))
        {
          this.fontWeight = value;
        }
        break;
      case "fontfamily":
        if (typeof value === "string")
        {
          this.fontFamily = value;
        }
        break;
      case "bgfillcolor":
        this.bgFillColor = value;
        break;
      case "imgwidth":
        this.width = Math.abs(value);
        break;
      case "imgheight":
        this.height = Math.abs(value);
        break;
      case "lorg":
        if (lorgVals.indexOf(value) !== -1)
        {
          this.lorg = value;
        }
        break;
      case "shadowoffsetx":
        this.shadowOffsetX = value || 0;
        break;
      case "shadowoffsety":
        this.shadowOffsetY = value || 0;
        break;
      case "shadowblur":
        this.shadowBlur = value || 0;
        break;
      case "shadowcolor":
        this.shadowColor = value;
        break;
      default:
        return;
    }
  }

  Obj2D = function()
  {
    this.type = "OBJ2D";
    this.cmdsAry = null;                      // Cgo2D array for path/shape outline or text/img bounding box
    this.drawCmds = null;                     // cmdsAry converted to DrawCmd objects
    this.lineWidthWC = null;                  // Path or border width world coords
    this.lineWidth = null;                    // Path or border width pixels
    this.savScale = 1;                        // Save the net scale factor applied to scale the lineWidth
    this.iso = true;                          // default for Shape, Img, Text
    this.parent = null;                       // pointer to parent Group if any
    this.dwgOrg = {x:0, y:0};                 // drawing origin (0,0) may get translated
    // properties handling transform inheritance
    this.hardTfmAry = [];                     // hard offset from any parent Group's transform
    this.ofsTfmAry = [];                      // soft offset from any parent Group's transform
    this.netTfmAry = [];                      // ofsTfmAry with grpTfmAry concatinated
    this.ofsTfm = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();      // product of hard & ofs tfm actions, filled in at render
    this.netTfm = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();      // parent Group netTfm applied to this.ofsTfm
    // enable obj.transform.rotate etc. API
    this.hardTransform = new HardTfmTools(this);    // hard transforms (they survive render)
    this.transform = new TfmTools(this);            // soft transforms (reset after render)
    this.dragNdrop = null;
  };

  Obj2D.prototype.enableDrag = function(grabFn, dragFn, dropFn)
  {
    this.dragNdrop = new Drag2D(grabFn, dragFn, dropFn);
    // fill in the Drag2D properties for use by callBacks
    this.dragNdrop.target = this;
  };

  Obj2D.prototype.disableDrag = function()
  {
    var aidx;

    if (!this.dragNdrop)
    {
      return;
    }
    // remove this object from array to be checked on mousedown
    aidx = this.dragNdrop.layer.dragObjects.indexOf(this);
    this.dragNdrop.layer.dragObjects.splice(aidx, 1);
    this.dragNdrop = null;
  };

  ClipMask = function(commands, options)
  {
    var opt = options || {};

    // build all the Obj2D properties and assign them to this Object's properties
    Obj2D.call(this);
    this.type = "CLIP";
    this.iso = false;    // default for ClipMask and Path options can change it

    if (!commands)
    {
      this.cmdsAry =  [];
      this.drawCmds = [];  // allow drawCmds.length == 0 for clipMask reset
    }
    else
    {
      if (typeof commands === "string")  // a string will be svg commands
      {
        this.cmdsAry = svgToCgo2D(commands);
      }
      else if (Array.isArray(commands))  // array will be Cgo2D commands array
      {
        this.cmdsAry = commands;
      }
      // we now have a valid cmdsAry
      if (typeof(this.cmdsAry[0]) === "number")  // must be an Array of numbers
      {
        this.cmdsAry.splice(0, 0, "M"); // add the "M" to start (remove none) so valid SVG
      }
      this.drawCmds = cgo2DToDrawCmds(this.cmdsAry);
    }
    // only option supported is 'iso' property
    if (opt.hasOwnProperty("iso"))
    {
      this.setProperty("iso", opt["iso"]);
    }
    else if (opt.hasOwnProperty("isotropic"))
    {
      this.setProperty("isotropic", opt["isotropic"]);
    }
    else
    {
      this.iso = false;   // default false allow word coords to distort
    }
  };

  // make all the Obj2D methods methods of this object
  ClipMask.prototype = Object.create(Obj2D.prototype);
  ClipMask.prototype.constructor = ClipMask;        // do this or prototype constructor still Obj2D

  ClipMask.prototype.setProperty = setPropertyFn;

  ClipMask.prototype.appendPath = function(obj, delMove)
  {
    var savThis = this,
        thisDcs,
        objDcs,
        pathOpen = true;

    if (this.drawCmds)
    {
      thisDcs = clone(this.drawCmds);
    }
    else // must have cmdsAry
    {
      thisDcs = cgo2DToDrawCmds(this.cmdsAry);
    }
    if (obj.drawCmds)
    {
      objDcs = clone(obj.drawCmds);
    }
    else  // must have cmdsAry
    {
      objDcs = cgo2DToDrawCmds(obj.cmdsAry);
    }

    // apply any hard tranforms that have been applied
    if (this.hardTfmAry.length)
    {
      // generate the hard tranform matrix if any transforms have been applied
      this.hardTfmAry.forEach(function(dtr){
        dtr.distortFn.call(savThis, dtr.args);
      });
      // this.ofsTfm now hold the hard transform matrix
      thisDcs.forEach(function(cmd){
        if (cmd.parmsWC.length)
        {
          cmd.parmsWC = cmd.parmsWC.map(function(p){    // assumes p is a 2 element array [x, y]
            var tp = transformPoint(p[0], p[1], savThis.ofsTfm);
            return [tp.x, tp.y];
          });
        }
      });
      matrixReset(this.ofsTfm);
      this.hardTfmAry.length = 0;       // Tfms have been applied clear them
    }
    // apply any hard tranforms that have been applied
    if (obj.hardTfmAry.length)
    {
      // generate the hard tranform matrix if any transforms have been applied
      obj.hardTfmAry.forEach(function(dtr){
        dtr.distortFn.call(obj, dtr.args);
      });
      // obj.ofsTfm now hold the hard transform matrix
      objDcs.forEach(function(cmd){
        if (cmd.parmsWC.length)
        {
          cmd.parmsWC = cmd.parmsWC.map(function(p){    // assumes p is a 2 element array [x, y]
            var tp = transformPoint(p[0], p[1], obj.ofsTfm);
            return [tp.x, tp.y];
          });
        }
      });
      matrixReset(obj.ofsTfm);
      // Tfms have only been applied to a copy so don't clear hardTfmAry
    }
    pathOpen = (thisDcs.length && thisDcs[thisDcs.length-1].drawFn !== "closePath");
    if (delMove && pathOpen)  // delete the inital 'moveTo' command only if path is not closed
    {
      this.drawCmds = thisDcs.concat(objDcs.slice(1));
    }
    else if (delMove && !pathOpen)
    {
      thisDcs.splice(-1,1);   // delete the 'closePath'
      this.drawCmds = thisDcs.concat(objDcs.slice(1));
    }
    else // no delMove so its a separate segment
    {
      this.drawCmds = thisDcs.concat(objDcs);
    }
  };

  /*======================================
   * Apply a translation transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  ClipMask.prototype.translate = function(x, y)
  {
    this.hardTransform.translate(x, y);
  };

  /*======================================
   * Apply a rotation transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  ClipMask.prototype.rotate = function(degs)
  {
    this.hardTransform.rotate(degs);
  };

  /*======================================
   * Apply a skew transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  ClipMask.prototype.skew = function(degH, degV)
  {
    this.hardTransform.skew(degH, degV);
  };

  /*======================================
   * Apply a scale transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  ClipMask.prototype.scale = function(xScl, yScl)
  {
    this.hardTransform.scale(xScl, yScl);
  };

  ClipMask.prototype.dup = function()
  {
    var newObj = new ClipMask();

    newObj.type = this.type;

    newObj.cmdsAry = clone(this.cmdsAry);
    newObj.drawCmds = clone(this.drawCmds);
    newObj.parent = null;                        // pointer to parent group if any
    newObj.dwgOrg = clone(this.dwgOrg);
    newObj.hardTfmAry = clone(this.hardTfmAry);  // hard offset from any parent Group's transform
    newObj.ofsTfmAry = clone(this.ofsTfmAry);    // soft offset from any parent Group's transform

    newObj.border = this.border;                 // ClipMask can a border (half width showing)
    newObj.strokeCol = this.strokeCol;
    newObj.lineWidth = this.lineWidth;
    newObj.lineWidthWC = this.lineWidthWC;
    newObj.lineCap = this.lineCap;
    newObj.iso = this.iso;
    // The other objects are dynamic, calculated at render

    return newObj;         // return a object which inherits Obj2D properties
  };

  Path = function(commands, options)
  {
    var opt, prop;

    // build all the ClipMask properties and assign them to this Object's properties
    ClipMask.call(this, commands);

    this.type = "PATH";               // type string to instruct the render method
    // properties set by setProperty method, if undefined render uses Cango default
    this.border = false;              // true = stroke outline with strokeColor & lineWidth
    this.strokeCol = null;            // render will stroke a path in this color
    this.fillCol = null;              // used if type == SHAPE or TEXT
    this.lineCap = null;              // round butt or square
    this.iso = false;                 // default for a Path
    // drop shadow properties
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.shadowBlur = 0;
    this.shadowColor = "#000000";
    // dashed line properties
    this.dashed = [];
    this.dashOffset = 0;

    // now handle all the user requested options
    opt = (typeof options === 'object')? options: {};   // avoid undeclared object errors
    // check for all supported options
    for (prop in opt)
    {
      // check that this is opt's own property, not inherited from prototype
      if (opt.hasOwnProperty(prop))
      {
        this.setProperty(prop, opt[prop]);
      }
    }
  };

  Path.prototype = Object.create(ClipMask.prototype);    // make the ClipMask methods the methods of this Path object
  Path.prototype.constructor = Path;        // do this or prototype constructor still ClipMask

  Path.prototype.setProperty = setPropertyFn;

  Path.prototype.revWinding = function()
  {
    // reverse the direction of drawing around a path, stops holes in shapes being filled
    var thisDcs,
        cmds,
        zCmd = null,
        revCmds = [],
        k, len,
        dParms, dCmd;

    function revPairs(ary)
    {
      // return a single array of x,y coords made by taking array of [x,y] arrays and reversing the order
      // eg. [[1,2], [3,4], [5,6]] returns [5,6,3,4,1,2]
      return ary.reduceRight(function(acc, curr){
        acc.push(curr[0], curr[1]);
        return acc;
      }, []);
    }

    if (this.drawCmds)
    {
      thisDcs = this.drawCmds;
    }
    else  // must have cmdsAry
    {
      thisDcs = cgo2DToDrawCmds(this.cmdsAry);
    }
    if (thisDcs[thisDcs.length-1].drawFn === "closePath")
    {
      cmds = thisDcs.slice(0, -1);  // leave off 'closePath'
      zCmd = thisDcs[thisDcs.length-1];
    }
    else
    {
      cmds = thisDcs.slice(0);  // copy the whole array
    }

    // now step back along the path
    k = cmds.length-1;    // k points at the last segment DrawCmd
    len = cmds[k].parmsWC.length;  // length of last DrawCmd's parmsWC array
    dCmd = new DrawCmd("moveTo", cmds[k].parmsWC[len-1]);   // make a 'M' command from final coord pair
    revCmds.push(dCmd);         // make this the first command of the output
    cmds[k].parmsWC = cmds[k].parmsWC.slice(0,-1);  // weve used the last point so slice it off
    while (k>0)
    {
      dParms = revPairs(cmds[k].parmsWC);   // dParms is a flat array
      len = cmds[k-1].parmsWC.length;       // find the last DrawCmd of the next segment back
      dParms = dParms.concat(cmds[k-1].parmsWC[len-1]); // add the last point of next cmd
      dCmd = new DrawCmd(cmds[k].drawFn, dParms);     // construct the DrawCmd for this segment
      revCmds.push(dCmd);                             // shove it out
      cmds[k-1].parmsWC = cmds[k-1].parmsWC.slice(0,-1);  // weve used the last point so slice it off
      k--;
    }
    // add the 'closePath' DrawCmd if it was a closed path
    if (zCmd)
    {
      revCmds.push(zCmd);
    }
    this.drawCmds = revCmds;
  };

  Path.prototype.dup = function()
  {
    var newObj = new Path();

    newObj.type = this.type;

    newObj.cmdsAry = clone(this.cmdsAry);
    newObj.drawCmds = clone(this.drawCmds);
    newObj.parent = null;                       // pointer to parent group if any
    newObj.dwgOrg = clone(this.dwgOrg);
    newObj.hardTfmAry = clone(this.hardTfmAry);  // hard offset from any parent Group's transform
    newObj.ofsTfmAry = clone(this.ofsTfmAry);    // soft offset from any parent Group's transform

    newObj.border = this.border;
    newObj.strokeCol = this.strokeCol;
    newObj.fillCol = this.fillCol;
    newObj.lineWidth = this.lineWidth;
    newObj.lineWidthWC = this.lineWidthWC;
    newObj.lineCap = this.lineCap;
    newObj.savScale = 1; 
    newObj.iso = this.iso;

    newObj.shadowOffsetX = this.shadowOffsetX;
    newObj.shadowOffsetY = this.shadowOffsetY;
    newObj.shadowBlur = this.shadowBlur;
    newObj.shadowColor = this.shadowColor;

    newObj.dashed = clone(this.dashed);
    newObj.dashOffset = this.dashOffset;
    // The other objects are dynamic, calculated at render

    return newObj;         // return a object which inherits Obj2D properties
  };

  Shape = function(commands, options)
  {
    var opt = options || {};

    // build all the Path properties and assign them to this Object's properties
    Path.call(this, commands, options);

    this.type = "SHAPE";
    // only difference is the default value for 'iso' property
    if (opt.hasOwnProperty("iso"))
    {
      this.setProperty("iso", opt["iso"]);
    }
    else if (opt.hasOwnProperty("isotropic"))
    {
      this.setProperty("isotropic", opt["isotropic"]);
    }
    else
    {
      this.iso = true;   // default true = maintain aspect ratio
    }
  };

  Shape.prototype = Object.create(Path.prototype);       // make the Path methods the methods of this Shape object
  Shape.prototype.constructor = Shape;        // do this or prototype constructor still Path

  Img = function(imgData, options)
  {
    var opt, prop;
    // build all the Obj2D properties and assign them to this Object's properties
    Obj2D.call(this);

    this.type = "IMG";
    if (typeof imgData === "string")
    {
      this.imgBuf = new Image();    // pointer to the Image object when image is loaded
      this.imgBuf.src = imgData;    // start loading the image immediately
    }
    else if (imgData instanceof Image)
    {
      this.imgBuf = imgData;        // pre-loaded Image passed
    }
    this.cmdsAry = null;              // Cgo2D array of bounding box
    this.drawCmds = null;             // DrawCmd array for the text or img bounding box
    this.width = 0;                   // only used for type = IMG, TEXT, set to 0 until image loaded
    this.height = 0;                  //     "
    this.imgLorgX = 0;                //     "
    this.imgLorgY = 0;                //     "
    this.lorg = 1;                    // used by IMG and TEXT to set drawing origin
    // properties set by setProperty method, if undefined render uses Cango default
    this.border = false;              // true = stroke outline with strokeColor & lineWidth
    this.strokeCol = null;            // render will stroke a path in this color
    this.lineWidthWC = null;          // border width world coords
    this.lineWidth = null;            // border width pixels
    this.lineCap = null;              // round, butt or square
    this.savScale = 1;                // save accumulated scale factors for lineWidth of border
    // drop shadow properties
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.shadowBlur = 0;
    this.shadowColor = "#000000";

    // now handle all the user requested options
    opt = (typeof options === 'object')? options: {};   // avoid undeclared object errors
    // check for all supported options
    for (prop in opt)
    {
      // check that this is opt's own property, not inherited from prototype
      if (opt.hasOwnProperty(prop))
      {
        this.setProperty(prop, opt[prop]);
      }
    }
  };

  // make all the Obj2D methods methods of this object
  Img.prototype = Object.create(Obj2D.prototype);
  Img.prototype.constructor = Img;        // do this or prototype constructor still Obj2D

  Img.prototype.setProperty = setPropertyFn;

  /*======================================
   * Apply a translation transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Img.prototype.translate = function(x, y)
  {
    this.hardTransform.translate(x, y);
  };

  /*======================================
   * Apply a rotation transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Img.prototype.rotate = function(degs)
  {
    this.hardTransform.rotate(degs);
  };

  /*======================================
   * Apply a skew transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Img.prototype.skew = function(degH, degV)
  {
    this.hardTransform.skew(degH, degV);
  };

  /*======================================
   * Apply a scale transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Img.prototype.scale = function(xScl, yScl)
  {
    this.hardTransform.scale(xScl, yScl);
  };

  Img.prototype.dup = function()
  {
    var newObj = new Img();

    newObj.type = this.type;
    newObj.cmdsAry = clone(this.cmdsAry);
    newObj.drawCmds = clone(this.drawCmds);
    newObj.imgBuf = this.imgBuf;         // just copy reference
    newObj.dwgOrg = clone(this.dwgOrg);
    newObj.dragNdrop = null;
    newObj.hardTfmAry = clone(this.hardTfmAry);  // hard offset from any parent Group's transform
    newObj.ofsTfmAry = clone(this.ofsTfmAry);    // soft offset from any parent Group's transform
    newObj.border = this.border;
    newObj.strokeCol = this.strokeCol;
    newObj.lineWidth = this.lineWidth;
    newObj.lineWidthWC = this.lineWidthWC;
    newObj.lineCap = this.lineCap;
    newObj.savScale = 1; 
    newObj.iso = this.iso;
    newObj.dashed = clone(this.dashed);
    newObj.dashOffset = this.dashOffset;
    newObj.width = this.width;
    newObj.height = this.height;
    newObj.imgLorgX = this.imgLorgX;
    newObj.imgLorgY = this.imgLorgY;
    newObj.lorg = this.lorg;
    newObj.shadowOffsetX = this.shadowOffsetX;
    newObj.shadowOffsetY = this.shadowOffsetY;
    newObj.shadowBlur = this.shadowBlur;
    newObj.shadowColor = this.shadowColor;
    // The other objects are dynamic, calculated at render

    return newObj;         // return a object which inherits Obj2D properties
  };

  Img.prototype.formatImg = function()
  {
    var wid, hgt, wid2, hgt2,
        dx = 0,
        dy = 0,
        ulx, uly, llx, lly, lrx, lry, urx, ury,
        lorgWC;

    if (!this.imgBuf.width)
    {
      console.log("in image onload handler yet image NOT loaded!");
    }
    if (this.width && this.height)
    {
      wid = this.width;
      hgt = this.height;
    }
    else if (this.width && !this.height)  // width only passed height is auto
    {
      wid = this.width;
      hgt = wid*this.imgBuf.height/this.imgBuf.width;  // default keep aspect ratio
    }
    else if (this.height && !this.width)  // height only passed width is auto
    {
      hgt = this.height;
      wid = hgt*this.imgBuf.width/this.imgBuf.height;    // default to keep aspect ratio
    }
    else    // no width or height default to natural size;
    {
      wid = this.imgBuf.width;    // default to natural width if none passed
      if (this.iso)
      {
        hgt = wid*this.imgBuf.height/this.imgBuf.width;  // default keep aspect ratio;
      }
      else
      {
        hgt = this.imgBuf.height;  // let the natural height scale with world coords
      }
    }
    wid2 = wid/2;
    hgt2 = hgt/2;
    lorgWC = [0, [0, 0],    [wid2, 0],   [wid, 0],
                 [0, hgt2], [wid2, hgt2], [wid, hgt2],
                 [0, hgt],  [wid2, hgt],  [wid, hgt]];
    if (lorgWC[this.lorg] !== undefined)
    {
      dx = -lorgWC[this.lorg][0];
      dy = -lorgWC[this.lorg][1];
    }
    this.imgLorgX = dx;     // world coords offset to drawing origin
    this.imgLorgY = dy;
    this.width = wid;       // default to natural width if none passed
    this.height = hgt;      // default to natural height if none passed
    // construct the cmdsAry for the Img bounding box
    ulx = dx;
    uly = dy;
    llx = dx;
    lly = dy+hgt;
    lrx = dx+wid;
    lry = dy+hgt;
    urx = dx+wid;
    ury = dy;
    this.cmdsAry = ["M", ulx, uly, "L", llx, lly, "L", lrx, lry, "L", urx, ury, "Z"];
    this.drawCmds = cgo2DToDrawCmds(this.cmdsAry);
  };

  Text = function(txtString, options)
  {
    var opt, prop;
    // build all the Obj2D properties and assign them to this Object's properties
    Obj2D.call(this);

    this.type = "TEXT";               // type string to instruct the render method
    this.txtStr = txtString;          // just store the text String
    this.cmdsAry = null;              // Cgo2D array of bounding box
    this.drawCmds = null;             // DrawCmd array for the text or img bounding box
    this.width = 0;                   // only used for type = IMG, TEXT, set to 0 until image loaded
    this.height = 0;                  //     "
    this.imgLorgX = 0;                //     "
    this.imgLorgY = 0;                //     "
    this.lorg = 1;                    // used by IMG and TEXT to set drawing origin
    // properties set by setProperty method, if undefined render uses Cango default
    this.border = false;              // true = stroke outline with strokeColor & lineWidth
    this.fillCol = null;              // only used if type == SHAPE or TEXT
    this.bgFillColor = null;          // only used if type = TEXT
    this.strokeCol = null;            // render will stroke a path in this color
    this.fontSize = null;             // fontSize in pixels (TEXT only)
    this.fontSizeZC = null;           // fontSize zoom corrected, scaled for any change in context xscl
    this.fontWeight = null;           // fontWeight 100..900 (TEXT only)
    this.fontFamily = null;           // (TEXT only)
    this.lineWidthWC = null;          // border width world coords
    this.lineWidth = null;            // border width pixels
    this.lineCap = null;              // round, butt or square
    this.savScale = 1;                // save acculmulated scale factors to scale lineWidth of border 
    // drop shadow properties
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.shadowBlur = 0;
    this.shadowColor = "#000000";

    // now handle all the user requested options
    opt = (typeof options === 'object')? options: {};   // avoid undeclared object errors
    // check for all supported options
    for (prop in opt)
    {
      // check that this is opt's own property, not inherited from prototype
      if (opt.hasOwnProperty(prop))
      {
        this.setProperty(prop, opt[prop]);
      }
    }
  };

  // make all the Obj2D methods methods of this object
  Text.prototype = Object.create(Obj2D.prototype);
  Text.prototype.constructor = Text;        // do this or prototype constructor still Obj2D

  Text.prototype.setProperty = setPropertyFn;

  /*======================================
   * Apply a translation transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Text.prototype.translate = function(x, y)
  {
    this.hardTransform.translate(x, y);
  };

  /*======================================
   * Apply a rotation transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Text.prototype.rotate = function(degs)
  {
    this.hardTransform.rotate(degs);
  };

  /*======================================
   * Apply a skew transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Text.prototype.skew = function(degH, degV)
  {
    this.hardTransform.skew(degH, degV);
  };

  /*======================================
   * Apply a scale transform to the
   * Obj2D's hardOfsTfm.
   *-------------------------------------*/
  Text.prototype.scale = function(xScl, yScl)
  {
    this.hardTransform.scale(xScl, yScl);
  };

  Text.prototype.dup = function()
  {
    var newObj = new Text();

    newObj.type = this.type;
    newObj.txtStr = this.txtStr.slice(0);
    newObj.cmdsAry = clone(this.cmdsAry);
    newObj.drawCmds = clone(this.drawCmds);
    newObj.imgBuf = this.imgBuf;         // just copy reference
    newObj.dwgOrg = clone(this.dwgOrg);
    newObj.hardTfmAry = clone(this.hardTfmAry);  // hard offset from any parent Group's transform
    newObj.ofsTfmAry = clone(this.ofsTfmAry);    // soft offset from any parent Group's transform
    newObj.border = this.border;
    newObj.strokeCol = this.strokeCol;
    newObj.fillCol = this.fillCol;
    newObj.bgFillColor = this.bgFillColor;
    newObj.lineWidth = this.lineWidth;
    newObj.lineWidthWC = this.lineWidthWC;
    newObj.lineCap = this.lineCap;
    newObj.savScale = 1; 
    newObj.dashed = clone(this.dashed);
    newObj.dashOffset = this.dashOffset;
    newObj.width = this.width;
    newObj.height = this.height;
    newObj.imgLorgX = this.imgLorgX;
    newObj.imgLorgY = this.imgLorgY;
    newObj.lorg = this.lorg;
    newObj.fontSize = this.fontSize;
    newObj.fontWeight = this.fontWeight;
    newObj.fontFamily = this.fontFamily;
    newObj.shadowOffsetX = this.shadowOffsetX;
    newObj.shadowOffsetY = this.shadowOffsetY;
    newObj.shadowBlur = this.shadowBlur;
    newObj.shadowColor = this.shadowColor;
    // The other objects are dynamic, calculated at render

    return newObj;         // return a object which inherits Obj2D properties
  };

  Text.prototype.formatText = function(gc)
  {
    var fntSz = this.fontSize || gc.fontSize,     // fontSize in pxls
        fntFm = this.fontFamily || gc.fontFamily,
        fntWt = this.fontWeight || gc.fontWeight,
        lorg = this.lorg || 1,
        wid, hgt,   // Note: char cell is ~1.4*fontSize pixels high
        wid2, hgt2,
        lorgWC,
        dx = 0,
        dy = 0,
        ulx, uly, llx, lly, lrx, lry, urx, ury,
        fntScl;

    // support for zoom and pan
    if (!this.orgXscl)
    {
      // first time drawn save the scale
      this.orgXscl = gc.xscl;
    }
    fntScl = gc.xscl/this.orgXscl;   // scale for any zoom factor
    this.fontSizeZC = fntSz*fntScl;
    // set the drawing context to measure the size
    gc.ctx.save();
    transformCtx(gc.ctx);  // reset to identity matrix
    gc.ctx.font = fntWt+" "+fntSz+"px "+fntFm;
    wid = gc.ctx.measureText(this.txtStr).width;  // width in pixels
    gc.ctx.restore();

    wid *= fntScl;   // handle zoom scaling
    hgt = fntSz;     // TEXT height from bottom of decender to top of capitals
    hgt *= fntScl;   // handle zoom scaling
    wid2 = wid/2;
    hgt2 = hgt/2;
    lorgWC = [0, [0, hgt],  [wid2, hgt],  [wid, hgt],
                 [0, hgt2], [wid2, hgt2], [wid, hgt2],
                 [0, 0],    [wid2, 0],    [wid, 0]];
    if (lorgWC[lorg] !== undefined)
    {
      dx = -lorgWC[lorg][0];
      dy = lorgWC[lorg][1];
    }
    this.imgLorgX = dx;           // pixel offsets to drawing origin
    this.imgLorgY = dy-0.25*hgt;  // correct for alphabetic baseline, its offset about 0.25*char height

    // construct the cmdsAry for the text bounding box (world coords)
    ulx = dx;
    uly = dy;
    llx = dx;
    lly = dy-hgt;
    lrx = dx+wid;
    lry = dy-hgt;
    urx = dx+wid;
    ury = dy;
    this.cmdsAry = ["M", ulx, uly, "L", llx, lly, "L", lrx, lry, "L", urx, ury, "Z"];
    this.drawCmds = cgo2DToDrawCmds(this.cmdsAry);
  };

  function transformCtx(ctx, xfm)  // apply a matrix transform to a canvas 2D context
  {
    if (xfm === undefined)
    {
      ctx.setTransform(1, 0, 0,
                       0, 1, 0);
    }
    else
    {
      ctx.setTransform(xfm.matrix[0][0], xfm.matrix[0][1], xfm.matrix[1][0],
                       xfm.matrix[1][1], xfm.matrix[2][0], xfm.matrix[2][1]);
    }
  }

//===============================================================================

  function AnimObj(id, gc, initFn, drawFn, pathFn, options)
  {
    var prop;

    this.id = id;
    this.gc = gc;        // the Cango context to do the drawing
    this.drawFn = drawFn;
    this.pathFn = pathFn;
    this.options = options;
    this.currState = {time:0};  // consider as read-only
    this.nextState = {time:0};  // properties can be added to this (becomes the currState after frame is drawn)
    this.gc.ctx.save();
    if (typeof initFn === "function")
    {
      initFn.call(this, this.options);  // call object creation code
    }
    // draw the object as setup by initFn (pathFn not called yet)
    if (typeof this.drawFn === "function")
    {
      this.drawFn.call(this, this.options);   // call user custom function
    }
    else
    {
      console.log("invalid animation draw function");
    }
    this.gc.ctx.restore();  // if initFn makes changes to ctx restore to pre-initFn state
    // now it has been drawn save the currState values (nextState values are generated by pathFn)
    for (prop in this.nextState)   // if initFn creates new properties, make currState match
    {
      if (this.nextState.hasOwnProperty(prop))
      {
        this.currState[prop] = this.nextState[prop];
      }
    }
  }

  // this is the actual animator that draws the frame
  function drawFrame(timeline)
  {
		var localTime,
				temp,
				prevAt = null,
				clearIt = false,
				time = Date.now();    // use this as a time stamp, browser don't all pass the same time code

		if (timeline.prevAnimMode === timeline.modes.STOPPED)
		{
			timeline.startTime = time - timeline.startOfs;                // forces localTime = 0 to start from beginning
		}
		localTime =  time - timeline.startTime;
		
		// step through all the animation tasks
		timeline.animTasks.forEach(function(at){
			if (at.gc.cId !== prevAt)
			{
				// check for new layer, only clear a layer once, there maybe several Cango contexts on each canvas
				clearIt = true;
				prevAt = at.gc.cId;
			}
			at.gc.ctx.save();
			// if re-starting after a stopAnimation reset the currState.time so pathFn doesn't get negative time between frames
			if (timeline.prevAnimMode === timeline.modes.STOPPED)
			{
				at.currState.time = 0;    // avoid -ve dT (=localTime-currState.time) in pathFn
			}
      if (clearIt)
      {
          at.gc.clearCanvas();
      }
			if (typeof(at.pathFn) === 'function')  // static objects may have null or undefined
			{
				at.pathFn.call(at, localTime, at.options);
			}
      if (typeof at.drawFn === "function")
      {
          at.drawFn.call(at, at.options);
      }
			clearIt = false;
			at.gc.ctx.restore(); // if pathFn changes any ctx properties restore to pre pathFn state
			// now swap the currState and nextState vectors (pathFn may use currState to gen nextState)
			temp = at.currState;
			at.currState = at.nextState; // save current state vector, pathFn will use it
			at.nextState = temp;
			// save the draw time for pathFn
			at.currState.time = localTime;  // save the localtime along the timeline for use by pathFn
		});

		timeline.currTime = localTime;      // timestamp of what is currently on screen
 	}
	
  function Timeline()
  {
    this.animTasks = [];    // each layer can push an AnimObj object in here
    this.timer = null;                // need to save the rAF id for cancelling
    this.modes = {PAUSED:1, STOPPED:2, PLAYING:3, STEPPING:4};     // animation modes
    this.animMode = this.modes.STOPPED;
    this.prevAnimMode = this.modes.STOPPED;
    this.startTime = 0;               // animation start time (relative to 1970)
    this.startOfs = 0;                // used if play calls with non-zero start time
    this.currTime = 0;                // timestamp of frame on screen
    this.stepTime = 50;               // animation step time interval (in msec)
  }

  Timeline.prototype.stopAnimation = function()
  {
    window.cancelAnimationFrame(this.timer);
    this.prevAnimMode = this.animMode;
    this.animMode = this.modes.STOPPED;
    // reset the currTime so play and step know to start again
    this.currTime = 0;
    this.startOfs = 0;
  };

  Timeline.prototype.pauseAnimation = function()
  {
    window.cancelAnimationFrame(this.timer);
    this.prevAnimMode = this.animMode;
    this.animMode = this.modes.PAUSED;
  };

  Timeline.prototype.stepAnimation = function()
  {
    var savThis = this;

    // this is the actual animator that draws the frame
    function drawIt()
    {
      drawFrame(savThis);
      savThis.prevAnimMode = savThis.modes.PAUSED;
      savThis.animMode = savThis.modes.PAUSED;
		}

    // eqivalent to play for one frame and pause
    if (this.animMode === this.modes.PLAYING)
    {
      return;
    }
    if (this.animMode === this.modes.PAUSED)
    {
      this.startTime = Date.now() - this.currTime;  // move time as if currFrame just drawn
    }
    this.prevAnimMode = this.animMode;
    this.animMode = this.modes.STEPPING;

    setTimeout(drawIt, this.stepTime);
  };

  Timeline.prototype.redrawAnimation = function()
  {
    // eqivalent to play for one frame and pause
    if (this.animMode === this.modes.PLAYING)
    {
      return;
    }
    this.startTime = Date.now() - this.currTime;  // move time as if currFrame just drawn

    drawFrame(this);
  };

  Timeline.prototype.playAnimation = function(startOfs, stopOfs)
  {
    var savThis = this;

    // this is the actual animator that draws each frame
    function drawIt()
    {
      drawFrame(savThis);
      savThis.prevAnimMode = savThis.modes.PLAYING;
      if (stopOfs)
      {
        if (savThis.currTime < stopOfs)
        {
          savThis.timer = window.requestAnimationFrame(drawIt);
        }
        else
        {
          savThis.stopAnimation();     // go back to start of time line
        }
      }
      else
      {
        savThis.timer = window.requestAnimationFrame(drawIt);   // go forever
      }
    }

    this.startOfs = startOfs || 0;
    if (this.animMode === this.modes.PLAYING)
    {
      return;
    }
    if (this.animMode === this.modes.PAUSED)
    {
      this.startTime = Date.now() - this.currTime;  // move time as if currFrame just drawn
    }
    this.prevAnimMode = this.animMode;
    this.animMode = this.modes.PLAYING;

    this.timer = window.requestAnimationFrame(drawIt);
  };
	
	//===============================================================================

  function Layer(canvasID, canvasElement)
  {
    this.id = canvasID;
    this.cElem = canvasElement;
    this.dragObjects = [];
  }

  function getLayer(cgo)
  {
    var i, lyr = cgo.bkgCanvas.layers[0];

    for (i=1; i < cgo.bkgCanvas.layers.length; i++)
    {
      if (cgo.bkgCanvas.layers[i].id === cgo.cId)
      {
        lyr = cgo.bkgCanvas.layers[i];
        break;
      }
    }
    return lyr;    // Layer object
  }

  function initDragAndDrop(savThis)
  {
    function dragHandler(evt)
    {
      var event = evt || window.event,
          csrPos, testObj, nLyrs, lyr,
          j, k;

      function getCursorPos(e)
      {
        // pass in any mouse event, returns the position of the cursor in raw pixel coords
        var rect = savThis.cnvs.getBoundingClientRect();

        return {x: e.clientX - rect.left, y: e.clientY - rect.top};
      }

      function hitTest(pathObj, csrX, csrY)
      {
        var gc = pathObj.dragNdrop.cgo,
            ysl = (gc.yDown)? gc.xscl: -gc.xscl,
            hit,
            WCtoPX = identityMatrix.translate(gc.vpOrgX+gc.xoffset, (gc.vpOrgY+gc.yoffset))
                                  .scaleNonUniform(gc.xscl, ysl)
                                  .multiply(pathObj.netTfm);

        if ((pathObj.type === 'IMG') && (!gc.yDown))
        {
          WCtoPX = WCtoPX.flipY();  // invert all world coords values
        }            
        else if (pathObj.type === 'TEXT')
        {
          WCtoPX = WCtoPX.scaleNonUniform(1/gc.xscl, 1/ysl);     // pre-invert to counter the invert to come
        }

        gc.ctx.save();       // save un-scaled
        gc.ctx.setTransform(WCtoPX.a, WCtoPX.b, WCtoPX.c, WCtoPX.d, WCtoPX.e, WCtoPX.f);
        gc.ctx.beginPath();
        pathObj.drawCmds.forEach(function(dCmd){
          var flatAry = [];   // start with new array
          dCmd.parmsWC.forEach(function(coord){
            flatAry.push(coord[0], coord[1]);
          });
          gc.ctx[dCmd.drawFn].apply(gc.ctx, flatAry); // add the path segment
        });
        hit = gc.ctx.isPointInPath(csrX, csrY);
 /*
  // for diagnostics on hit region, uncomment
  gc.ctx.strokeStyle = 'red';
  gc.ctx.lineWidth = (pathObj.type === 'TEXT')? 3: 3/gc.xscl;
  gc.ctx.stroke();
 */
        gc.ctx.restore();

        return hit;
      }

      csrPos = getCursorPos(event);  // savThis is any Cango ctx on the canvas
      nLyrs = savThis.bkgCanvas.layers.length;
      // run through all the registered objects and test if cursor pos is in their path
      loops:      // label to break out of nested loops
      for (j = nLyrs-1; j >= 0; j--)       // search top layer down the stack
      {
        lyr = savThis.bkgCanvas.layers[j];
        for (k = lyr.dragObjects.length-1; k >= 0; k--)  // search from last drawn to first (underneath)
        {
          testObj = lyr.dragObjects[k];
          if (hitTest(testObj, csrPos.x, csrPos.y))
          {
            // call the grab handler for this object (check it is still enabled)
            if (testObj.dragNdrop)
            {
              testObj.dragNdrop.grab(event);
              break loops;
            }
          }
        }
      }
    }

    // =========== Start Here ===========

    savThis.cnvs.onmousedown = dragHandler;   // added to all layers but only top layer will catch events
  }

  Cango = function(canvasId)
  {
    var savThis = this,
        bkgId, bkgL;

    function setResizeHandler(callback, timeout) 
    {
      var timer_id = undefined;
      window.addEventListener("resize", function() {
        if(timer_id != undefined) 
        {
            clearTimeout(timer_id);
            timer_id = undefined;
        }
        timer_id = setTimeout(function(){
            timer_id = undefined;
            callback();
          }, timeout);
      });
    }
      
    function resizeLayers()
    {
      var j, ovl,
          t = savThis.bkgCanvas.offsetTop + savThis.bkgCanvas.clientTop,
          l = savThis.bkgCanvas.offsetLeft + savThis.bkgCanvas.clientLeft,
          w = savThis.bkgCanvas.offsetWidth,
          h = savThis.bkgCanvas.offsetHeight;

      // check if canvas is resized when window -resized, allow some rounding error in layout calcs
      if ((Math.abs(w - savThis.rawWidth)/w < 0.01) && (Math.abs(h - savThis.rawHeight)/h < 0.01))
      {
        // canvas size idin't change so return
        return;
      }
      // canvas has been resized so re0size all the overlay canvases
      // kill off any animations on resize (else they stil contiune along with any new ones)
      if (savThis.bkgCanvas.timeline && savThis.bkgCanvas.timeline.animTasks.length)
      {
        savThis.deleteAllAnimations();
      }
      // fix all Cango contexts to know about new size
      savThis.rawWidth = w;
      savThis.rawHeight = h;
      savThis.aRatio = w/h;
      // there may be multiple Cango contexts a layer, try to only fix actual canvas properties once
      if (savThis.bkgCanvas !== savThis.cnvs)
      {
        return undefined;
      }
      savThis.cnvs.setAttribute('width', w);    // reset canvas pixels width
      savThis.cnvs.setAttribute('height', h);   // don't use style for this
      // step through the stack of canvases (if any)
      for (j=1; j<savThis.bkgCanvas.layers.length; j++)  // bkg is layer[0]
      {
        ovl = savThis.bkgCanvas.layers[j].cElem;
        if (ovl)
        {
          ovl.style.top = t+'px';
          ovl.style.left = l+'px';
          ovl.style.width = w+'px';
          ovl.style.height = h+'px';
          ovl.setAttribute('width', w);    // reset canvas pixels width
          ovl.setAttribute('height', h);   // don't use style for this
        }
      }
    }

    this.cId = canvasId;
    this.cnvs = document.getElementById(canvasId);
    if (this.cnvs === null)
    {
      alert("can't find canvas "+canvasId);
      return undefined;
    }
    this.bkgCanvas = this.cnvs;  // this is a background canvas so bkgCanvas points to itself
    // check if this is a context for an overlay
    if (canvasId.indexOf("_ovl_") !== -1)
    {
      // this is an overlay. get a reference to the backGround canvas
      bkgId = canvasId.slice(0,canvasId.indexOf("_ovl_"));
      this.bkgCanvas = document.getElementById(bkgId);
    }
    this.rawWidth = this.cnvs.offsetWidth;
    this.rawHeight = this.cnvs.offsetHeight;
    this.aRatio = this.rawWidth/this.rawHeight;
    this.widthPW = 100;                          // width of canvas in Percent Width Coords
    this.heightPW = 100/this.aRatio;    // height of canvas in Percent Width Coords
    if (!this.bkgCanvas.hasOwnProperty('layers'))
    {
      // create an array to hold all the overlay canvases for this canvas
      this.bkgCanvas.layers = [];
      // make a Layer object for the bkgCanvas
      bkgL = new Layer(this.cId, this.cnvs);
      this.bkgCanvas.layers[0] = bkgL;
      // make sure the overlay canvases always match the bkgCanvas size
      setResizeHandler(resizeLayers, 250);
    }
    if ((typeof Timeline !== "undefined") && !this.bkgCanvas.hasOwnProperty('timeline'))
    {
      // create a single timeline for all animations on all layers
      this.bkgCanvas.timeline = new Timeline();
    }
    if (!this.cnvs.hasOwnProperty('resized'))
    {
      // make canvas native aspect ratio equal style box aspect ratio.
      // Note: rawWidth and rawHeight are floats, assignment to ints will truncate
      this.cnvs.setAttribute('width', this.rawWidth);    // reset canvas pixels width
      this.cnvs.setAttribute('height', this.rawHeight);  // don't use style for this
      this.cnvs.resized = true;
    }
    this.ctx = this.cnvs.getContext('2d');    // draw direct to screen canvas
    this.yDown = true;                // set by setWordlCoordsRHC & setWorldCoordsSVG (SVG is default)
    this.vpW = this.rawWidth;         // vp width in pixels (no more viewport so use full canvas)
    this.vpH = this.rawHeight;        // vp height in pixels, canvas height = width/aspect ratio
    this.vpOrgX = 0;                  // gridbox origin in pixels (upper left for SVG, the default)
    this.vpOrgY = 0;                  // gridbox origin in pixels (upper left for SVG, the default)
    this.xscl = 1;                    // world x axis scale factor, default: pixels
    this.yscl = 1;                    // world y axis scale factor, +ve down (SVG style default)
    this.xoffset = 0;                 // world x origin offset from viewport left in pixels
    this.yoffset = 0;                 // world y origin offset from viewport bottom in pixels
    this.savWC = {"xscl":this.xscl,
                  "yscl":this.yscl,
                  "xoffset":this.xoffset,
                  "yoffset":this.yoffset};  // save world coords for zoom/pan
    this.ctx.textAlign = "left";      // all offsets are handled by lorg facility
    this.ctx.textBaseline = "alphabetic";
    this.penCol = "rgba(0, 0, 0, 1.0)";        // black
    this.penWid = 1;                  // pixels
    this.lineCap = "butt";
    this.paintCol = "rgba(128,128,128,1.0)";   // gray
    this.fontSize = 12;               // pixels
    this.fontWeight = 400;            // 100..900, 400 = normal,700 = bold
    this.fontFamily = "Consolas, Monaco, 'Andale Mono', monospace";
    this.clipCount = 0;               // count ClipMask calls for use by resetClip

    this.getUnique = function()
    {
      uniqueVal += 1;     // a private 'global'
      return uniqueVal;
    };

    initDragAndDrop(this);
  };

  Cango.prototype.animation = function(init, draw, path, options)
  {
    var animObj,
        animId;

    animId = this.cId+"_"+this.getUnique();
    animObj = new AnimObj(animId, this, init, draw, path, options);
    // push this into the Cango animations array
    this.stopAnimation();   // make sure we are not still running an old animation
    this.bkgCanvas.timeline.animTasks.push(animObj);

    return animObj.id;   // so the animation just created can be deleted if required
  };

  Cango.prototype.pauseAnimation = function()
  {
    this.bkgCanvas.timeline.pauseAnimation();
  };

  Cango.prototype.playAnimation = function(startTime, stopTime)
  {
    this.bkgCanvas.timeline.playAnimation(startTime, stopTime);
  };

  Cango.prototype.stopAnimation = function()
  {
    this.bkgCanvas.timeline.stopAnimation();
  };

  Cango.prototype.stepAnimation = function()
  {
    this.bkgCanvas.timeline.stepAnimation();
  };

  Cango.prototype.deleteAnimation = function(animId)
  {
    var idx = -1,
        i;

    this.pauseAnimation();   // pause all animations
    for (i=0; i<this.bkgCanvas.timeline.animTasks.length; i++)
    {
      if (this.bkgCanvas.timeline.animTasks[i].id === animId)
      {
        idx = i;
        break;
      }
    }
    if (idx === -1)
    {
      // not found
      return;
    }
    this.bkgCanvas.timeline.animTasks.splice(idx, 1);       // delete the animation object
  };

  Cango.prototype.deleteAllAnimations = function()
  {
    this.stopAnimation();
    this.bkgCanvas.timeline.animTasks = [];
  };

  Cango.prototype.toPixelCoords = function(x, y)
  {
    // transform x,y in world coords to canvas pixel coords (top left is 0,0 y axis +ve down)
    var xPx = this.vpOrgX+this.xoffset+x*this.xscl,
        yPx = this.vpOrgY+this.yoffset+y*this.yscl;

    return {x: xPx, y: yPx};
  };

  Cango.prototype.toWorldCoords = function(xPx, yPx)
  {
    // transform xPx,yPx in raw canvas pixels to world coords (lower left is 0,0 +ve up)
    var xW = (xPx - this.vpOrgX - this.xoffset)/this.xscl,
        yW = (yPx - this.vpOrgY - this.yoffset)/this.yscl;

    return {x: xW, y: yW};
  };

  Cango.prototype.getCursorPosWC = function(evt)
  {
    // pass in any mouse event, returns the position of the cursor in raw pixel coords
    var e = evt||window.event,
        rect = this.cnvs.getBoundingClientRect(),
        xW = (e.clientX - rect.left - this.vpOrgX - this.xoffset)/this.xscl,
        yW = (e.clientY - rect.top - this.vpOrgY - this.yoffset)/this.yscl;

    return {x: xW, y: yW};
  };

  Cango.prototype.clearCanvas = function(fillColor)
  {
    var savThis = this,
        layerObj;

    function genLinGradient(lgrad)
    {
      var p1 = savThis.toPixelCoords(lgrad.grad[0], lgrad.grad[1]),
          p2 = savThis.toPixelCoords(lgrad.grad[2], lgrad.grad[3]),
          grad = savThis.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);

      lgrad.colorStops.forEach(function(colStop){grad.addColorStop(colStop[0], colStop[1]);});

      return grad;
    }

    function genRadGradient(rgrad)
    {
      var p1 = savThis.toPixelCoords(rgrad.grad[0], rgrad.grad[1]),
          r1 = rgrad.grad[2]*savThis.xscl,
          p2 = savThis.toPixelCoords(rgrad.grad[3], rgrad.grad[4]),
          r2 = rgrad.grad[5]*savThis.xscl,
          grad = savThis.ctx.createRadialGradient(p1.x, p1.y, r1, p2.x, p2.y, r2);

      rgrad.colorStops.forEach(function(colStop){grad.addColorStop(colStop[0], colStop[1]);});

      return grad;
    }

    if (fillColor)
    {
      this.ctx.save();
      if (fillColor instanceof LinearGradient)
      {
        this.ctx.fillStyle = genLinGradient(fillColor);
      }
      else if (fillColor instanceof RadialGradient)
      {
        this.ctx.fillStyle = genRadGradient(fillColor);
      }
      else
      {
        this.ctx.fillStyle = fillColor;
      }
      this.ctx.fillRect(0, 0, this.rawWidth, this.rawHeight);
      this.ctx.restore();
    }
    else
    {
      this.ctx.clearRect(0, 0, this.rawWidth, this.rawHeight);
    }
    // all drawing erased, but graphics contexts remain intact
    // clear the dragObjects array, draggables put back when rendered
    layerObj = getLayer(this);
    layerObj.dragObjects.length = 0;
    // in case the CangoHTMLtext extension is used
    if (this.cnvs.alphaOvl && this.cnvs.alphaOvl.parentNode)
    {
      this.cnvs.alphaOvl.parentNode.removeChild(this.cnvs.alphaOvl);
    }
  };

  Cango.prototype.gridboxPadding = function(left, bottom, right, top)
  {
    // left, bottom, right, top are the padding from the respective sides, all are in % of canvas width units
    // negative values are set to 0.
    var savThis = this,
        width,
        height;

    function setDefault()
    {
      savThis.vpW = savThis.rawWidth;
      savThis.vpH = savThis.rawHeight;
      savThis.vpOrgX = 0;
      savThis.vpOrgY = 0;
      savThis.setWorldCoordsSVG(); // if new gridbox created, world coords are garbage, so reset to defaults
    }

    if (left === undefined)   // no error just resetiing to default
    {
      setDefault();
      return;
    }
    // check if only left defined
    if (bottom === undefined)  // only one parameter
    {
      if ((left >= 50) || (left < 0))
      {
        console.error("gridbox right must be greater than left");
        setDefault();
        return;
      }
      else
      {
        bottom = left;
      }
    }
    if ((left < 0) || (left > 99))
    {
      left = 0;
    }
    // now we have a valid left and a bottom
    if ((bottom < 0) || (bottom > 99/this.aRatio))
    {
      bottom = 0;
    }
    if (right === undefined)   // right == 0 is OK
    {
      right = left;
    }
    else if (right < 0)
    {
      right = 0;
    }
    if (top === undefined)    // top == 0 is OK
    {
      top = bottom;
    }
    else if (top < 0)
    {
      top = 0;
    }
    // now we have all 4 valid padding values
    width = 100 - left - right;
    height = 100/this.aRatio - top - bottom;

    if ((width < 0) || (height < 0))
    {
      console.error("invalid gridbox dimensions");
      setDefault();
      return;
    }

    this.vpW = width*this.rawWidth/100;
    this.vpH = height*this.rawWidth/100;
    // now calc upper left of viewPort in pixels = this is the vpOrg
    this.vpOrgX = left*this.rawWidth/100;
    this.vpOrgY = top*this.rawWidth/100;     // SVG vpOrg is up at the top left
    this.yDown = true;                       // reset, both setWorldCoords needs this  
    this.setWorldCoordsSVG(); // if new gridbox created, world coords are garbage, so reset to defaults
  };

  Cango.prototype.fillGridbox = function(fillColor)
  {
    var savThis = this,
        newCol = fillColor || this.paintCol,
        yCoord = (this.yDown)? this.vpOrgY: this.vpOrgY-this.vpH;

    function genLinGradient(lgrad)
    {
      var p1 = savThis.toPixelCoords(lgrad.grad[0], lgrad.grad[1]),
          p2 = savThis.toPixelCoords(lgrad.grad[2], lgrad.grad[3]),
          grad = savThis.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);

      lgrad.colorStops.forEach(function(colStop){grad.addColorStop(colStop[0], colStop[1]);});

      return grad;
    }

    function genRadGradient(rgrad)
    {
      var p1 = savThis.toPixelCoords(rgrad.grad[0], rgrad.grad[1]),
          r1 = rgrad.grad[2]*savThis.xscl,
          p2 = savThis.toPixelCoords(rgrad.grad[3], rgrad.grad[4]),
          r2 = rgrad.grad[5]*savThis.xscl,
          grad = savThis.ctx.createRadialGradient(p1.x, p1.y, r1, p2.x, p2.y, r2);

      rgrad.colorStops.forEach(function(colStop){grad.addColorStop(colStop[0], colStop[1]);});

      return grad;
    }

    this.ctx.save();
    if (newCol instanceof LinearGradient)
    {
      this.ctx.fillStyle = genLinGradient(newCol);
    }
    else if (newCol instanceof RadialGradient)
    {
      this.ctx.fillStyle = genRadGradient(newCol);
    }
    else
    {
      this.ctx.fillStyle = newCol;
    }
    this.ctx.fillRect(this.vpOrgX, yCoord, this.vpW, this.vpH); // fillRect(left, top, wid, hgt)
    this.ctx.restore();
  };

  Cango.prototype.setWorldCoordsSVG = function(vpOriginX, vpOriginY, spanX, spanY)
  {
    // gridbox origin is upper left
    var vpOrgXWC = vpOriginX || 0,  // gridbox upper left (vpOrgX) in world coords
        vpOrgYWC = vpOriginY || 0;  // gridbox upper left (vpOrgY) in world coords

    if (!this.yDown)  // RHC coords being used, switch to SVG, must change to vpOrgY
    {
      this.vpOrgY -= this.vpH;  // switch vpOrg to upper left corner of gridbox
      this.yDown = true;        // flag true for SVG world coords being used
    }
    if (spanX && (spanX > 0))
    {
      this.xscl = this.vpW/spanX;
    }
    else
    {
      this.xscl = 1;                   // use pixel units
    }
    if (spanY && (spanY > 0))
    {
      this.yscl = this.vpH/spanY;     // yscl is positive for SVG
    }
    else
    {
      this.yscl = this.xscl;          // square pixels
    }
    this.xoffset = -vpOrgXWC*this.xscl;
    this.yoffset = -vpOrgYWC*this.yscl;   // reference to upper left of gridbox
    // save values to support resetting zoom and pan
    this.savWC = {"xscl":this.xscl, "yscl":this.yscl, "xoffset":this.xoffset, "yoffset":this.yoffset};
  };

  Cango.prototype.setWorldCoordsRHC = function(vpOriginX, vpOriginY, spanX, spanY)
  {
    // gridbox origin is upper left
    var vpOrgXWC = vpOriginX || 0,  // gridbox lower left (vpOrgX) in world coords
        vpOrgYWC = vpOriginY || 0;  // gridbox lower left (vpOrgY) in world coords

    if (this.yDown)  // SVG coords being used, switch to RHC must change to vpOrgY
    {
      this.vpOrgY += this.vpH;  // switch vpOrg to lower left corner of gridbox
      this.yDown = false;       // flag false for RHC world coords
    }
    if (spanX && (spanX > 0))
    {
      this.xscl = this.vpW/spanX;
    }
    else
    {
      this.xscl = 1;                   // use pixel units
    }
    if (spanY && (spanY > 0))
    {
      this.yscl = -this.vpH/spanY;    // yscl is negative for RHC
    }
    else
    {
      this.yscl = -this.xscl;          // square pixels
    }
    this.xoffset = -vpOrgXWC*this.xscl;
    this.yoffset = -vpOrgYWC*this.yscl;
    // save these values to support resetting zoom and pan
    this.savWC = {"xscl":this.xscl, "yscl":this.yscl, "xoffset":this.xoffset, "yoffset":this.yoffset};
  };

  Cango.prototype.setPropertyDefault = function(propertyName, value)
  {
    if ((typeof propertyName !== "string")||(value === undefined)||(value === null))
    {
      return;
    }
    switch (propertyName.toLowerCase())
    {
      case "fillcolor":
        if ((typeof value === "string")||(typeof value === "object"))  // gradient will be an object
        {
          this.paintCol = value;
        }
        break;
      case "strokecolor":
        if ((typeof value === "string")||(typeof value === "object"))  // gradient will be an object
        {
          this.penCol = value;
        }
        break;
      case "linewidth":
      case "strokewidth":
        this.penWid = value;
        break;
      case "linecap":
        if ((typeof value === "string")&&((value === "butt")||(value ==="round")||(value === "square")))
        {
          this.lineCap = value;
        }
        break;
      case "fontfamily":
        if (typeof value === "string")
        {
          this.fontFamily = value;
        }
        break;
      case "fontsize":
        this.fontSize = value;
        break;
      case "fontweight":
        if ((typeof value === "string")||((value >= 100)&&(value <= 900)))
        {
          this.fontWeight = value;
        }
        break;
      case "steptime":
        if ((value >= 15)&&(value <= 500))
        {
          this.stepTime = value;
        }
        break;
      default:
        return;
    }
  };

  Cango.prototype.dropShadow = function(obj)  // no argument will reset to no drop shadows 
  {
    var xOfs = 0,
        yOfs = 0,
        radius = 0,
        color = "#000000",
        xScale = 1,
        yScale = 1;

    if (obj != undefined)
    {
      xOfs = obj.shadowOffsetX || 0;
      yOfs = obj.shadowOffsetY || 0;
      radius = obj.shadowBlur || 0;
      color = obj.shadowColor || "#000000";
      if ((obj.type === "SHAPE")||((obj.type === "PATH")&& !obj.iso))   // must scale for world coords (matrix scaling not used)
      {
        xScale *= this.xscl;
        yScale *= this.yscl;
      }
      else                         // no need to scale here (matrix scaling used)
      {
        xScale *= this.xscl;
        yScale *= -this.xscl;
      }
    }
      this.ctx.shadowOffsetX = xOfs*xScale;
      this.ctx.shadowOffsetY = yOfs*yScale;
      this.ctx.shadowBlur = radius*xScale;
      this.ctx.shadowColor = color;
  };

  /*=============================================
   * render will draw a Group or Obj2D.
   * If an Obj2D is passed, update the netTfm
   * and render it.
   * If a Group is passed, recursively update
   * the netTfm of the group's family tree,
   * then render all Obj2Ds.
   *--------------------------------------------*/
  Cango.prototype.render = function(rootObj, clear)
  {
    var savThis = this,
        objAry,
        nonIsoScl = Math.abs(savThis.yscl/savThis.xscl);

    function genNetTfmMatrix(obj)
    {
      var toIso;
      if (!obj.iso)
      {
        toIso = new Distorter("SCL", scaler, 1, nonIsoScl);
        // apply the non-iso world coord scaling to the original y coords
        obj.netTfmAry.unshift(toIso);   // scale distorter will do the job
      }
      matrixReset(obj.ofsTfm);  // clear out previous transforms
      obj.savScale = 1;            // reset the scale factor for re-calc
      // apply the net transform to the obj2D trandform matrix
      obj.netTfmAry.forEach(function(dtr){
        // calc accumulated scaling to apply to lineWidth
        if (dtr.type === "SCL")
        {
          obj.savScale *= Math.abs(dtr.args[0]);
        }
        // apply world coord scaling to dwgOrg translations
        if (dtr.type === "TRN")
        {
          // call the user distort fn to do the distorting now
          if (obj.iso)
            dtr.distortFn.call(obj, [dtr.args[0], dtr.args[1]*nonIsoScl]);
          else
            dtr.distortFn.call(obj, [dtr.args[0], dtr.args[1]]);  
        }
        else
        {
          dtr.distortFn.call(obj, dtr.args);
        }
      });
      obj.netTfm = obj.ofsTfm.multiply(obj.grpTfm); // apply inherited group Tfms
    }

    function genNetTfm(obj)
    {
      var grpTfmAry, grpTfm, softTfmAry;

      if (obj.parent)   // must be a child of a Group
      {
        grpTfmAry = obj.parent.netTfmAry;    // grpTfm is always netTfm of the parent Group
        grpTfm = obj.parent.netTfm;
      }
      else                                   // must be the rootObj
      {
        grpTfmAry = [];
        grpTfm = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();
      }
      // now generate the soft transforms (that's all a Group has, hard are passed on immediately)
      softTfmAry = grpTfmAry.concat(obj.ofsTfmAry);
      if (obj.type === "GRP")
      {
        obj.netTfmAry = softTfmAry;
      }
      else
      {
        obj.netTfmAry = softTfmAry.concat(obj.hardTfmAry);
        // save the inherited transforms to be applied when obj ready to render (Images may not be loaded)
        obj.grpTfm = grpTfm;
      }
      // apply the soft transforms to the dwgOrg of the Group or the Obj2D
      // NB: hard Transforms don't move dwgOrg, they move the object relative to dwgOrg!
      obj.dwgOrg = {x:0, y:0};
      softTfmAry.forEach(function(dtr){
        obj.dwgOrg = dtr.distortFn.call(obj.dwgOrg, dtr.args);
      });
    }

    function recursiveGenNetTfm()
    {
      var flatAry = [];

      // task:function, grp: group with children
      function iterate(task, obj)
      {
        task(obj);
        if (obj.type === "GRP")    // find Obj2Ds to draw
        {
        obj.children.forEach(function(childNode){
            iterate(task, childNode);
            });
        }
        else
        {
        flatAry.push(obj);       // just push into the array to be drawn
        }
      }
      // now propagate the current grpXfm through the tree of children
      iterate(genNetTfm, rootObj);

      return flatAry;
    }

    function processObj2D(obj)
    {
      function imgLoaded()
      {
        obj.formatImg();
        genNetTfmMatrix(obj);
        savThis.paintImg(obj);
      }

      if (obj.type === "IMG")
      {
        if (obj.imgBuf.complete)    // see if already loaded
        {
          imgLoaded();
        }
        else
        {
          addEvent(obj.imgBuf, 'load', imgLoaded);
        }
      }
      else if (obj.type === "TEXT")
      {
        obj.formatText(savThis);
        genNetTfmMatrix(obj);
        savThis.paintText(obj);
      }
      else if (obj.type === "CLIP")
      {
        genNetTfmMatrix(obj);
        savThis.applyClipMask(obj);
      }
      else // "PATH" or "SHAPE"
      {
        genNetTfmMatrix(obj);
        savThis.paintPath(obj);
      }
    }

  	function iterativeReset(obj)
  	{
   	  obj.transform.reset();
  	  if (obj.type === "GRP")
      {
    	obj.children.forEach(function(childNode){
  		  iterativeReset(childNode);
  		});
      }
  	}

// ============ Start Here =====================================================

    if (typeof rootObj.type !== "string")  // "GRP", "PATH", "SHAPE", "IMG", "TEXT", "CLIP"
    {
      console.log("render called on bad object type");
      return;
    }
    if (clear === true)
    {
      this.clearCanvas();
    }
    if (rootObj.type === "GRP")
    {
      // recursively apply transforms and return the flattened tree as an array of Obj2D to be drawn
      objAry = recursiveGenNetTfm();
      // now render the Obj2Ds onto the canvas
      objAry.forEach(processObj2D);
    }
    else   // single Obj2D, type = "PATH", "SHAPE", "IMG", "TEXT", "CLIP"
    {
      genNetTfm(rootObj);
      // draw the single Obj2D onto the canvas
      processObj2D(rootObj);
    }
    // all rendering done so recursively reset the dynamic ofsTfmAry
    iterativeReset(rootObj);
    this.resetClip();         // clear all active masks
  };

  Cango.prototype.genLinGrad = function(lgrad, tfm)
  {
    var p1x = lgrad.grad[0],
        p1y = lgrad.grad[1],
        p2x = lgrad.grad[2],
        p2y = lgrad.grad[3],
        tp1 = transformPoint(p1x, p1y, tfm),
        tp2 = transformPoint(p2x, p2y, tfm),
        grad = this.ctx.createLinearGradient(tp1.x, tp1.y, tp2.x, tp2.y);
    
    lgrad.colorStops.forEach(function(colStop){grad.addColorStop(colStop[0], colStop[1]);});

    return grad;
  };

  Cango.prototype.genRadGrad = function(rgrad, tfm, scl)
  {
    var p1x = rgrad.grad[0],
        p1y = rgrad.grad[1],
        r1 = rgrad.grad[2]*scl, 
        p2x = rgrad.grad[3],
        p2y = rgrad.grad[4],
        r2 = rgrad.grad[5]*scl,
        tp1 = transformPoint(p1x, p1y, tfm),
        tp2 = transformPoint(p2x, p2y, tfm),
        grad = this.ctx.createRadialGradient(tp1.x, tp1.y, r1, tp2.x, tp2.y, r2);

    rgrad.colorStops.forEach(function(colStop){grad.addColorStop(colStop[0], colStop[1]);});

    return grad;
  };

  Cango.prototype.paintImg = function(imgObj)
  {
    // should only be called after image has been loaded into imgBuf
    var savThis = this,
        img = imgObj.imgBuf,  // this is the place the image is stored in object
        ysl = (this.yDown)? this.xscl: -this.xscl,
        currLr, aidx,
        col, stkCol,
        tp,
        WCtoPX = identityMatrix.translate(this.vpOrgX + this.xoffset, this.vpOrgY + this.yoffset)   //  viewport offset
                              .scaleNonUniform(this.xscl, ysl)     // world coords to pixels
                              .multiply(imgObj.netTfm);       // app transforms

    if (!this.yDown)
    {
      WCtoPX = WCtoPX.flipY();  // invert all world coords values
    }            

    this.ctx.save();   // save raw canvas no transforms no dropShadow
    this.ctx.setTransform(WCtoPX.a, WCtoPX.b, WCtoPX.c, WCtoPX.d, WCtoPX.e, WCtoPX.f);
    this.dropShadow(imgObj);  // set up dropShadow if any
    // now insert the image canvas ctx will apply transforms (width etc in WC)
    this.ctx.drawImage(img, imgObj.imgLorgX, imgObj.imgLorgY, imgObj.width, imgObj.height);
    this.ctx.restore();   // revert to no drop shadow no transforms ready for border
    if (imgObj.border)
    {
      this.ctx.beginPath();
      imgObj.drawCmds.forEach(function(dCmd){
        var flatAry = [];   // start with new array
        dCmd.parmsWC.forEach(function(coord){
          tp = transformPoint(coord[0], coord[1], WCtoPX);
          flatAry.push(tp.x, tp.y);
        });
        savThis.ctx[dCmd.drawFn].apply(savThis.ctx, flatAry); // add the path segment
      });
      this.ctx.save();
      col = imgObj.strokeCol || this.penCol;
      if (col instanceof LinearGradient)
      {
        stkCol = this.genLinGrad(col, WCtoPX);
      }
      else if (col instanceof RadialGradient)
      {
        stkCol = this.genRadGrad(col, WCtoPX, imgObj.savScale*this.xscl);
      }
      else
      {
        stkCol = col;
      }
      if (imgObj.lineWidthWC)
      {
        this.ctx.lineWidth = imgObj.lineWidthWC*imgObj.savScale*this.xscl;   // lineWidth in world coords so scale to px
      }
      else
      {
        this.ctx.lineWidth = imgObj.lineWidth || this.penWid; 
      }
      this.ctx.strokeStyle = stkCol;
      // if properties are undefined use Cango default
      this.ctx.lineCap = imgObj.lineCap || this.lineCap;
      this.ctx.stroke();
      this.ctx.restore();    // undo the stroke style etc
    }

    if (imgObj.dragNdrop !== null)
    {
      // update dragNdrop layer to match this canvas
      currLr = getLayer(this);
      if (currLr !== imgObj.dragNdrop.layer)
      {
        if (imgObj.dragNdrop.layer)  // if not the first time rendered
        {
          // remove the object reference from the old layer
          aidx = imgObj.dragNdrop.layer.dragObjects.indexOf(this);
          if (aidx !== -1)
          {
            imgObj.dragNdrop.layer.dragObjects.splice(aidx, 1);
          }
        }
      }
      imgObj.dragNdrop.cgo = this;
      imgObj.dragNdrop.layer = currLr;
      // now push it into Cango.dragObjects array, its checked by canvas mousedown event handler
      if (!imgObj.dragNdrop.layer.dragObjects.contains(imgObj))
      {
        imgObj.dragNdrop.layer.dragObjects.push(imgObj);
      }
    }
  };

  Cango.prototype.paintPath = function(pathObj)
  {
    // used for type: PATH, SHAPE
    var savThis = this,
        tp,
        ysl = (this.yDown)? this.xscl: -this.xscl,
        col, filCol, stkCol,
        currLr, aidx,
        WCtoPX = identityMatrix.translate(this.vpOrgX+this.xoffset, (this.vpOrgY+this.yoffset))
                               .scaleNonUniform(this.xscl, ysl)
                               .multiply(pathObj.netTfm);

    this.ctx.save();   // save current context
    // make a scaled path that will render onto raw pixel scaling so lineWidth doesn't get distorted by non-iso scaling
    this.ctx.beginPath();                      // make the canvas 'current path' the scaled path
    pathObj.drawCmds.forEach(function(dCmd){
      var flatAry = [];   // start with new array
      dCmd.parmsWC.forEach(function(coord){
        tp = transformPoint(coord[0], coord[1], WCtoPX);
        flatAry.push(tp.x, tp.y);
      });
      savThis.ctx[dCmd.drawFn].apply(savThis.ctx, flatAry); // add the path segment
    });  

    col = pathObj.fillCol || this.paintCol;
    if (col instanceof LinearGradient)
    {
      filCol = this.genLinGrad(col, WCtoPX);
    }
    else if (col instanceof RadialGradient)
    {
      filCol = this.genRadGrad(col, WCtoPX, pathObj.savScale*this.xscl);
    }
    else
    {
      filCol = col;
    }
    col = pathObj.strokeCol || this.penCol;
    if (col instanceof LinearGradient)
    {
      stkCol = this.genLinGrad(col, WCtoPX);
    }
    else if (col instanceof RadialGradient)
    {
      stkCol = this.genRadGrad(col, WCtoPX, pathObj.savScale*this.xscl);
    }
    else
    {
      stkCol = col;
    }
    this.dropShadow(pathObj);    // set up dropShadow if any
    if (pathObj.type === "SHAPE")
    {
      this.ctx.fillStyle = filCol;
      this.ctx.fill();
    }
    if ((pathObj.type === "PATH")|| pathObj.border)
    {
      if (pathObj.border) // drop shadows for Path not border
      {
        // if Shape with border clear any drop shadow so not rendered twice
        this.dropShadow(); 
      }
      // handle dashed lines
      if (Array.isArray(pathObj.dashed) && pathObj.dashed.length)
      {
        this.ctx.setLineDash(pathObj.dashed);
        this.ctx.lineDashOffset = pathObj.dashOffset || 0;
      }
      // support for zoom and pan changing line width
      if (pathObj.lineWidthWC)
      {
        this.ctx.lineWidth = pathObj.lineWidthWC*pathObj.savScale*this.xscl;   // lineWidth in world coords so scale to px
      }
      else
      {
        this.ctx.lineWidth = pathObj.lineWidth || this.penWid; // lineWidth in pixels
      }
      // pathObj.strokeCol may be a function that generates dynamic color (so call it)
      this.ctx.strokeStyle = stkCol;
      this.ctx.lineCap = pathObj.lineCap || this.lineCap;
      this.ctx.stroke();   // stroke the current path
      this.ctx.setLineDash([]);   // clean up dashes (they are not reset by save/restore)
      this.ctx.lineDashOffset = 0;
    }
    this.ctx.restore();   // restore canvas ctx to raw pixels before stroking to prevent line width scaling
    if (pathObj.dragNdrop !== null)
    {
      // update dragNdrop layer to match this canvas
      currLr = getLayer(this);
      if (currLr !== pathObj.dragNdrop.layer)
      {
        if (pathObj.dragNdrop.layer)  // if not the first time rendered
        {
          // remove the object reference from the old layer
          aidx = pathObj.dragNdrop.layer.dragObjects.indexOf(this);
          if (aidx !== -1)
          {
            pathObj.dragNdrop.layer.dragObjects.splice(aidx, 1);
          }
        }
      }
      pathObj.dragNdrop.cgo = this;
      pathObj.dragNdrop.layer = currLr;
      // now push it into Cango.dragObjects array, its checked by canvas mousedown event handler
      if (!pathObj.dragNdrop.layer.dragObjects.contains(pathObj))
      {
        pathObj.dragNdrop.layer.dragObjects.push(pathObj);
      }
    }
  };

  Cango.prototype.applyClipMask = function(maskObj)
  {
    // if empty array for definition then reset clip to full canvas
    if (!maskObj.drawCmds.length)
    {
      this.resetClip();
      return;
    }

    var savThis = this,
        tp,
        ysl = (this.yDown)? this.xscl: -this.xscl,
        WCtoPX = identityMatrix.translate(this.vpOrgX+this.xoffset, (this.vpOrgY+this.yoffset))
                              .scaleNonUniform(this.xscl, ysl)
                              .multiply(maskObj.netTfm);

    this.ctx.save();   // save current context
    this.clipCount += 1;
    // make a scaled path that will render onto raw pixel scaling so lineWidth doesn't get distorted by non-iso scaling
    this.ctx.beginPath();
    maskObj.drawCmds.forEach(function(dCmd){
      var flatAry = [];   // start with new array
      dCmd.parmsWC.forEach(function(coord){
        tp = transformPoint(coord[0], coord[1], WCtoPX);
        flatAry.push(tp.x, tp.y);
      });
      savThis.ctx[dCmd.drawFn].apply(savThis.ctx, flatAry); // add the path segment
    });
    this.ctx.closePath();    // clip only works if path colosed
    this.ctx.clip();

    // FF 52 bugfix: force clip to take effect
    //============================================================================================
    // Workaround for Firefox 52 bug: "clip doesn't clip radial gradient fills"
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.0)";
    this.ctx.fillRect(0,0,1,1);   // any fill call will do will do
    //============================================================================================
  };

  Cango.prototype.resetClip = function()
  {
    while (this.clipCount > 0)
    {
      this.ctx.restore();
      this.clipCount--;
    }
  };

  Cango.prototype.paintText = function(txtObj)
  {
    var savThis = this,
        ysl = (this.yDown)? this.xscl: -this.xscl,
        fntWt, fntSz, fntFm,
        currLr, aidx,
        WCtoPX = identityMatrix.translate(this.vpOrgX + this.xoffset, this.vpOrgY + this.yoffset)   //  viewport offset
                              .scaleNonUniform(this.xscl, ysl)     // world coords to pixels
                              .multiply(txtObj.netTfm)
                              .scaleNonUniform(1/this.xscl, 1/ysl);       // app transforms

    // if Obj2D fontWeight or fontSize undefined use Cango default
    fntWt = txtObj.fontWeight || this.fontWeight;
    fntSz = txtObj.fontSizeZC;        // font size in pixels corrected for any zoom scaling factor
    fntFm = txtObj.fontFamily || this.fontFamily;

    this.ctx.save();   // save raw canvas no transforms no dropShadow
    this.ctx.setTransform(WCtoPX.a, WCtoPX.b, WCtoPX.c, WCtoPX.d, WCtoPX.e, WCtoPX.f);

    // if a bgFillColor is specified then fill the bounding box before rendering the text
    if (typeof txtObj.bgFillColor === "string")
    {
      // create the bounding box path
      this.ctx.save();
      this.ctx.fillStyle = txtObj.bgFillColor;
      this.ctx.strokeStyle = txtObj.bgFillColor;
      this.ctx.lineWidth = 0.10*fntSz;  // expand by 5% (10% width gives 5% outside outline)
      this.ctx.beginPath();
      txtObj.drawCmds.forEach(function(dCmd){
        var flatAry = [];   // start with new array
        dCmd.parmsWC.forEach(function(coord){
          flatAry.push(coord[0], coord[1]);
        });
        savThis.ctx[dCmd.drawFn].apply(savThis.ctx, flatAry); // add the path segment
      });
      this.ctx.fill();
      this.ctx.stroke();  // stroke the outline
      this.ctx.restore();
    }
    // now draw the text
    this.ctx.font = fntWt+" "+fntSz+"px "+fntFm;
    this.ctx.fillStyle = txtObj.fillCol || this.paintCol;
    this.ctx.fillText(txtObj.txtStr, txtObj.imgLorgX, txtObj.imgLorgY); // imgLorgX,Y are in pixels for text
    if (txtObj.border)
    {
      this.dropShadow(); // clear dropShadow, dont apply to the border (it will be on top of fill)
      // support for zoom and pan changing lineWidth
      if (txtObj.lineWidthWC)
      {
        this.ctx.lineWidth = txtObj.lineWidthWC*this.xscl;
      }
      else
      {
        this.ctx.lineWidth = txtObj.lineWidth || this.penWid;
      }
      // if properties are undefined use Cango default
      this.ctx.strokeStyle = txtObj.strokeCol || this.penCol;
      this.ctx.lineCap = txtObj.lineCap || this.lineCap;
      this.ctx.strokeText(txtObj.txtStr, txtObj.imgLorgX, txtObj.imgLorgY);
    }
    // undo the transforms
    this.ctx.restore();
    if (txtObj.dragNdrop !== null)
    {
      // update dragNdrop layer to match this canavs
      currLr = getLayer(this);
      if (currLr !== txtObj.dragNdrop.layer)
      {
        if (txtObj.dragNdrop.layer)  // if not the first time rendered
        {
          // remove the object reference from the old layer
          aidx = txtObj.dragNdrop.layer.dragObjects.indexOf(this);
          if (aidx !== -1)
          {
            txtObj.dragNdrop.layer.dragObjects.splice(aidx, 1);
          }
        }
      }
      txtObj.dragNdrop.cgo = this;
      txtObj.dragNdrop.layer = currLr;
      // now push it into Cango.dragObjects array, its checked by canvas mousedown event handler
      if (!txtObj.dragNdrop.layer.dragObjects.contains(txtObj))
      {
        txtObj.dragNdrop.layer.dragObjects.push(txtObj);
      }
    }
  };

  Cango.prototype.drawPath = function(pathDef, options)
  {
    var opts = options || {},
        x = opts.x || 0,
        y = opts.y || 0,
        scl = opts.scl || 1,
        degs = opts.degs || 0,
        pathObj = new Path(pathDef, options);

    if (degs)
    {
      pathObj.transform.rotate(degs);
    }
    if (scl !== 1)
    {
      pathObj.transform.scale(scl);
    }
    if (x || y)
    {
      pathObj.transform.translate(x, y);
    }
    this.render(pathObj);
  };

  Cango.prototype.drawShape = function(pathDef, options)
  {
    // outline the same as fill color
    var opts = options || {},
        x = opts.x || 0,
        y = opts.y || 0,
        scl = opts.scl || 1,
        degs = opts.degs || 0,
        pathObj = new Shape(pathDef, options);

    if (degs)
    {
      pathObj.transform.rotate(degs);
    }
    if (scl !== 1)
    {
      pathObj.transform.scale(scl);
    }
    if (x || y)
    {
      pathObj.transform.translate(x, y);
    }
    this.render(pathObj);
  };

  Cango.prototype.drawText = function(str, options)
  {
    var opts = options || {},
        x = opts.x || 0,
        y = opts.y || 0,
        scl = opts.scl || 1,
        degs = opts.degs || 0,
        txtObj = new Text(str, options);

    if (degs)
    {
      txtObj.transform.rotate(degs);
    }
    if (scl !== 1)
    {
      txtObj.transform.scale(scl);
    }
    if (x || y)
    {
      txtObj.transform.translate(x, y);
    }
    this.render(txtObj);
  };

  Cango.prototype.drawImg = function(imgRef, options)  // just load img then call render
  {
    var opts = options || {},
        x = opts.x || 0,
        y = opts.y || 0,
        scl = opts.scl || 1,
        degs = opts.degs || 0,
        imgObj = new Img(imgRef, options);

    if (degs)
    {
      imgObj.transform.rotate(degs);
    }
    if (scl !== 1)
    {
      imgObj.transform.scale(scl);
    }
    if (x || y)
    {
      imgObj.transform.translate(x, y);
    }
    this.render(imgObj);
  };

  Cango.prototype.createLayer = function()
  {
    var ovlHTML, newCvs,
        w = this.rawWidth,
        h = this.rawHeight,
        unique, ovlId,
        nLyrs = this.bkgCanvas.layers.length,  // bkg is layer 0 so at least 1
        newL,
        topCvs;

    // do not create layers on overlays - only an background canvases
    if (this.cId.indexOf("_ovl_") !== -1)
    {
      // this is an overlay canvas - can't have overlays itself
      console.log("canvas layers can't create layers");
      return "";
    }

    unique = this.getUnique();
    ovlId = this.cId+"_ovl_"+unique;
    ovlHTML = "<canvas id='"+ovlId+"' style='position:absolute' width='"+w+"' height='"+h+"'></canvas>";
    topCvs = this.bkgCanvas.layers[nLyrs-1].cElem;  // eqv to this.cnvs.layers since only bkgCanavs can get here
    topCvs.insertAdjacentHTML('afterend', ovlHTML);
    newCvs = document.getElementById(ovlId);
    newCvs.style.backgroundColor = "transparent";
    newCvs.style.left = (this.bkgCanvas.offsetLeft+this.bkgCanvas.clientLeft)+'px';
    newCvs.style.top = (this.bkgCanvas.offsetTop+this.bkgCanvas.clientTop)+'px';
    // make it the same size as the background canvas
    newCvs.style.width = this.bkgCanvas.offsetWidth+'px';
    newCvs.style.height = this.bkgCanvas.offsetHeight+'px';
//    newCvs.style.pointerEvents = 'none';    // allow mouse events to pass down to bkgCanvas
    newL = new Layer(ovlId, newCvs);
    // save the ID in an array to facilitate removal
    this.bkgCanvas.layers.push(newL);

    return ovlId;    // return the new canvas id for call to new Cango(id)
  };

  Cango.prototype.deleteLayer = function(ovlyId)
  {
    var ovlNode, i;

    for (i=1; i<this.bkgCanvas.layers.length; i++)
    {
      if (this.bkgCanvas.layers[i].id === ovlyId)
      {
        ovlNode = this.bkgCanvas.layers[i].cElem;
        if (ovlNode)
        {
          // in case the CangoHTMLtext extension is used
          if (ovlNode.alphaOvl && ovlNode.alphaOvl.parentNode)
          {
            ovlNode.alphaOvl.parentNode.removeChild(ovlNode.alphaOvl);
          }
          ovlNode.parentNode.removeChild(ovlNode);
        }
        // now delete layers array element
        this.bkgCanvas.layers.splice(i,1);       // delete the id
      }
    }
  };

  Cango.prototype.deleteAllLayers = function()
  {
    var i, ovlNode;

    for (i = this.bkgCanvas.layers.length-1; i>0; i--)   // don't delete layers[0] its the bakg canavs
    {
      ovlNode = this.bkgCanvas.layers[i].cElem;
      if (ovlNode)
      {
        // in case the CangoHTMLtext extension is used
        if (ovlNode.alphaOvl && ovlNode.alphaOvl.parentNode)
        {
          ovlNode.alphaOvl.parentNode.removeChild(ovlNode.alphaOvl);
        }
        ovlNode.parentNode.removeChild(ovlNode);
      }
      // now delete layers array element
      this.bkgCanvas.layers.splice(i,1);
    }
  };

  // copy the basic graphics context values (for an overlay)
  Cango.prototype.dupCtx = function(src_graphCtx)
  {
    // copy all the graphics context parameters into the overlay ctx.
    this.yDown = src_graphCtx.yDown;      // set by setWorldCoordsRHC or setWorldCoordsSVG to signal coord system
    this.vpW = src_graphCtx.vpW;          // vp width in pixels
    this.vpH = src_graphCtx.vpH;          // vp height in pixels
    this.vpOrgX = src_graphCtx.vpOrgX;    // vp lower left from canvas left in pixels
    this.vpOrgY = src_graphCtx.vpOrgY;    // vp lower left from canvas top
    this.xscl = src_graphCtx.xscl;        // world x axis scale factor
    this.yscl = src_graphCtx.yscl;        // world y axis scale factor
    this.xoffset = src_graphCtx.xoffset;  // world x origin offset from viewport left in pixels
    this.yoffset = src_graphCtx.yoffset;  // world y origin offset from viewport bottom in pixels
    this.savWC = clone(src_graphCtx.savWC);
    this.penCol = src_graphCtx.penCol.slice(0);   // copy value not reference
    this.penWid = src_graphCtx.penWid;    // pixels
    this.lineCap = src_graphCtx.lineCap.slice(0);
    this.paintCol = src_graphCtx.paintCol.slice(0);
    this.fontSize = src_graphCtx.fontSize;
    this.fontWeight = src_graphCtx.fontWeight;
    this.fontFamily = src_graphCtx.fontFamily.slice(0);
  };

  /*----------------------------------------------------------
   * 'initZoomPan' creates a Cango context on the overlay
   * canvas whose ID is passed as 'zpControlId'.
   * All the Cango context that is to be zoomed or panned
   * is passed in 'gc'. 'gc' may be an array of Cango contexts
   * if more than one canvas layer needs zooming.
   * The user defined function 'redraw' will be called to
   * redraw all the Cobjs on all the canvases in the new
   * zoomed or panned size or position.
   *---------------------------------------------------------*/
  initZoomPan = function(zpControlsId, gc, redraw)
  {
    var arw = ['m',-7,-2,'l',7,5,7,-5],
        crs = ['m',-6,-6,'l',12,12,'m',0,-12,'l',-12,12],
        pls = ['m',-7,0,'l',14,0,'m',-7,-7,'l',0,14],
        mns = ['m',-7,0,'l',14,0],
        zin, zout, rst, up, dn, lft, rgt,
        zpGC, gAry;

    function zoom(z)
    {
      function zm(g)
      {
        var org = g.toPixelCoords(0, 0),
            cx = g.rawWidth/2 - org.x,
            cy = g.rawHeight/2 - org.y;

        g.xoffset += cx - cx/z;
        g.yoffset += cy - cy/z;
        g.xscl /= z;
        g.yscl /= z;
      }

      gAry.forEach(zm);
      redraw();
    }

    function pan(sx, sy)
    {
      function pn(g)
      {
        g.xoffset -= sx;
        g.yoffset -= sy;
      }

      gAry.forEach(pn);
      redraw();
    }

    function resetZoomPan()
    {
      function rstzp(g)
      {
        g.xscl = g.savWC.xscl;
        g.yscl = g.savWC.yscl;
        g.xoffset = g.savWC.xoffset;
        g.yoffset = g.savWC.yoffset;
      }

      gAry.forEach(rstzp);
      redraw();
    }

    zpGC = new Cango(zpControlsId);
    // Zoom controls
    zpGC.clearCanvas();
    zpGC.setWorldCoordsRHC(-zpGC.rawWidth+44,-zpGC.rawHeight+44);

    // make a shaded rectangle for the controls
    zpGC.drawShape(shapeDefs.rectangle(114, 80), {x:-17, y:0, fillColor: "rgba(0, 50, 0, 0.12)"});

    rst = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    rst.enableDrag(null, null, resetZoomPan);
    zpGC.render(rst);

    rgt = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    // must always enable DnD before rendering !
    rgt.enableDrag(null, null, function(){pan(50, 0);});
    rgt.translate(22, 0);
    zpGC.render(rgt);

    up = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    up.enableDrag(null, null, function(){pan(0, -50);});
    up.translate(0, 22);
    zpGC.render(up);

    lft = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    lft.enableDrag(null, null, function(){pan(-50, 0);});
    lft.translate(-22, 0);
    zpGC.render(lft);

    dn = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    dn.enableDrag(null, null, function(){pan(0, 50);});
    dn.translate(0, -22);
    zpGC.render(dn);

    zin = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    zin.enableDrag(null, null, function(){zoom(1/1.2);});
    zin.translate(-56, 11);
    zpGC.render(zin);

    zout = new Shape(shapeDefs.rectangle(20, 20, 2), {fillColor:"rgba(0,0,0,0.2)"});
    zout.enableDrag(null, null, function(){zoom(1.2);});
    zout.translate(-56, -11);
    zpGC.render(zout);

    arw = ['m',-7,-2,'l',7,5,7,-5];
    zpGC.drawPath(arw, {x:0, y:22, strokeColor:"white", lineWidth:2});
    zpGC.drawPath(arw, {x:22, y:0, strokeColor:"white", lineWidth:2, degs:-90});
    zpGC.drawPath(arw, {x:-22, y:0, strokeColor:"white", lineWidth:2, degs:90});
    zpGC.drawPath(arw, {x:0, y:-22, strokeColor:"white", lineWidth:2, degs:180});
    zpGC.drawPath(pls, {x:-56, y:11, strokeColor:"white", lineWidth:2});
    zpGC.drawPath(mns, {x:-56, y:-11, strokeColor:"white", lineWidth:2});
    zpGC.drawPath(crs, {strokeColor:"white", lineWidth:2});

    if (Array.isArray(gc))
    {
      gAry = gc;
    }
    else
    {
      gAry = [];
      gAry[0] = gc;
    }
  };

  return Cango;
}());
