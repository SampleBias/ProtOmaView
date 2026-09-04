import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import QtQuick.Controls
import Qt.labs.folderlistmodel
import qs.Commons
import "Molecule.js" as Molecule

Item {
  id: root
  property var shell: null
  property bool opened: false
  property bool dragActive: false
  property bool loading: false
  property bool filePickerOpen: false
  property url currentFolder: "file://" + Quickshell.env("HOME")
  property string filePath: ""
  property string fileName: ""
  property string errorMessage: ""
  property var structure: null
  property real rotationX: -0.28
  property real rotationY: 0.55
  property real zoom: 1.0
  property string renderMode: "cartoon"
  property string colorScheme: "chain"
  property bool showLigands: true
  property point lastPointer: Qt.point(0, 0)

  readonly property color background: Color.menu.background
  readonly property color foreground: Color.menu.text
  readonly property color accent: Color.accent
  readonly property color borderColor: Color.menu.border
  readonly property color muted: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.58)
  readonly property string fontFamily: Style.font.family

  function open(payloadJson) {
    opened = true
    if (payloadJson) {
      try {
        var payload = JSON.parse(String(payloadJson))
        if (payload && payload.path) loadPath(String(payload.path))
      } catch (e) {}
    }
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() { opened = false }
  function requestClose() {
    if (shell && typeof shell.hide === "function") shell.hide("io.github.samplebias.protomaview")
    else close()
  }

  function localPath(url) {
    var value = String(url || "")
    if (value.indexOf("file://") === 0) value = value.substring(7)
    try { return decodeURIComponent(value) } catch (e) { return value }
  }

  function validPath(path) { return /\.(pdb|ent|cif|mmcif)$/i.test(path) }
  function openPicker() {
    filePickerOpen = true
    Qt.callLater(function() { pickerList.forceActiveFocus() })
  }
  function closePicker() {
    filePickerOpen = false
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }
  function loadPath(path) {
    path = localPath(path)
    if (!validPath(path)) {
      errorMessage = "Choose a .pdb, .ent, .cif, or .mmcif file"
      return
    }
    errorMessage = ""
    loading = true
    filePath = path
    fileName = path.substring(path.lastIndexOf("/") + 1)
    structureFile.path = path
    structureFile.reload()
  }

  function parseLoaded(text) {
    try {
      structure = Molecule.parse(text, fileName)
      rotationX = -0.28; rotationY = 0.55; zoom = 1.0
      errorMessage = ""
      viewer.requestPaint()
    } catch (e) {
      structure = null
      errorMessage = String(e.message || e)
    }
    loading = false
  }

  function cycleMode() {
    renderMode = renderMode === "cartoon" ? "backbone" : renderMode === "backbone" ? "atoms" : renderMode === "atoms" ? "wireframe" : "cartoon"
    viewer.requestPaint()
  }

  function smoothPath(ctx, points) {
    if (!points || points.length < 2) return false
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (var i=1; i<points.length-1; i++) {
      var mx=(points[i].x+points[i+1].x)/2
      var my=(points[i].y+points[i+1].y)/2
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
    }
    ctx.lineTo(points[points.length-1].x, points[points.length-1].y)
    return true
  }

  function drawCartoonRibbon(ctx, points, color, ribbonWidth) {
    if (!smoothPath(ctx, points)) return
    ctx.globalAlpha=0.5
    ctx.strokeStyle="#05070d"
    ctx.lineWidth=ribbonWidth+4
    ctx.stroke()
    smoothPath(ctx, points)
    ctx.globalAlpha=0.96
    ctx.strokeStyle=color
    ctx.lineWidth=ribbonWidth
    ctx.stroke()
    smoothPath(ctx, points)
    ctx.globalAlpha=0.22
    ctx.strokeStyle="#ffffff"
    ctx.lineWidth=Math.max(1, ribbonWidth*0.18)
    ctx.stroke()

    if (points.length < 3) return
    var tip=points[points.length-1], from=points[points.length-2]
    var dx=tip.x-from.x, dy=tip.y-from.y, length=Math.sqrt(dx*dx+dy*dy)
    if (length < 0.1) return
    dx/=length; dy/=length
    var nx=-dy, ny=dx, head=Math.max(8,ribbonWidth*1.45), half=Math.max(5,ribbonWidth*0.72)
    ctx.beginPath()
    ctx.moveTo(tip.x+dx*head*0.55,tip.y+dy*head*0.55)
    ctx.lineTo(tip.x-dx*head+nx*half,tip.y-dy*head+ny*half)
    ctx.lineTo(tip.x-dx*head-nx*half,tip.y-dy*head-ny*half)
    ctx.closePath()
    ctx.globalAlpha=0.96; ctx.fillStyle=color; ctx.fill()
    ctx.globalAlpha=1
  }
  function cycleColor() {
    colorScheme = colorScheme === "chain" ? "element" : colorScheme === "element" ? "bfactor" : "chain"
    viewer.requestPaint()
  }

  FileView {
    id: structureFile
    printErrors: false
    onLoaded: root.parseLoaded(text())
    onLoadFailed: function(error) { root.loading=false; root.structure=null; root.errorMessage="Could not read file: " + error }
  }

  FolderListModel {
    id: folderModel
    folder: root.currentFolder
    nameFilters: ["*.pdb", "*.ent", "*.cif", "*.mmcif"]
    showDirs: true
    showDirsFirst: true
    showDotAndDotDot: true
    showHidden: false
    sortField: FolderListModel.Name
  }

  PanelWindow {
    id: window
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "protoma-view"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: root.opened ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
    exclusionMode: ExclusionMode.Ignore

    Rectangle { anchors.fill: parent; color: Qt.rgba(0.02, 0.025, 0.035, 0.91) }

    Item {
      id: keyCatcher
      anchors.fill: parent
      focus: true
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) { root.requestClose(); event.accepted=true }
        else if (event.key === Qt.Key_O && (event.modifiers & Qt.ControlModifier)) { root.openPicker(); event.accepted=true }
        else if (event.key === Qt.Key_R) { root.rotationX=-0.28; root.rotationY=0.55; root.zoom=1; viewer.requestPaint(); event.accepted=true }
        else if (event.key === Qt.Key_M) { root.cycleMode(); event.accepted=true }
        else if (event.key === Qt.Key_C) { root.cycleColor(); event.accepted=true }
      }

      Rectangle {
        id: card
        anchors.fill: parent
        anchors.margins: Math.max(18, Math.min(window.width, window.height) * 0.035)
        radius: 18
        color: root.background
        border.width: 1
        border.color: root.borderColor

        Column {
          id: header
          x: 24; y: 18; width: parent.width - 48
          spacing: 4
          Text { text: "ProtOmaView"; color: root.accent; font.family: root.fontFamily; font.pixelSize: 20; font.bold: true; font.letterSpacing: 3 }
          Text {
            width: parent.width
            text: root.structure ? root.fileName : "Local molecular structure viewer"
            color: root.foreground; opacity: root.structure ? 1 : 0.7
            font.family: root.fontFamily; font.pixelSize: 13; elide: Text.ElideMiddle
          }
        }

        Row {
          id: actions
          anchors.top: parent.top; anchors.topMargin: 18; anchors.right: parent.right; anchors.rightMargin: 18
          spacing: 8
          Repeater {
            model: [
              {label:"OPEN", action:"open"},
              {label:root.renderMode.toUpperCase(), action:"mode"},
              {label:root.colorScheme.toUpperCase(), action:"color"},
              {label:"CLOSE", action:"close"}
            ]
            delegate: Rectangle {
              required property var modelData
              width: buttonLabel.implicitWidth + 20; height: 30; radius: 8
              color: buttonMouse.containsMouse ? Qt.rgba(root.accent.r, root.accent.g, root.accent.b, 0.18) : "transparent"
              border.width: 1; border.color: root.borderColor
              Text { id: buttonLabel; anchors.centerIn: parent; text: modelData.label; color: root.foreground; font.family: root.fontFamily; font.pixelSize: 11; font.bold: true }
              MouseArea {
                id: buttonMouse; anchors.fill: parent; hoverEnabled: true
                onClicked: {
                  if (modelData.action === "open") root.openPicker()
                  else if (modelData.action === "mode") root.cycleMode()
                  else if (modelData.action === "color") root.cycleColor()
                  else root.requestClose()
                }
              }
            }
          }
        }

        Rectangle {
          id: stage
          anchors.left: parent.left; anchors.right: parent.right; anchors.top: header.bottom; anchors.bottom: footer.top
          anchors.margins: 18; anchors.topMargin: 16
          radius: 14
          color: Qt.rgba(0.015, 0.02, 0.03, 0.72)
          border.width: root.dragActive ? 2 : 1
          border.color: root.dragActive ? root.accent : root.borderColor
          clip: true

          Canvas {
            id: viewer
            anchors.fill: parent
            visible: root.structure !== null
            renderTarget: Canvas.FramebufferObject
            onPaint: {
              var ctx=getContext("2d"); ctx.reset(); ctx.clearRect(0,0,width,height)
              if (!root.structure || !root.structure.atoms) return
              var atoms=root.structure.atoms, rx=root.rotationX, ry=root.rotationY
              var cx=Math.cos(rx), sx=Math.sin(rx), cy=Math.cos(ry), sy=Math.sin(ry)
              var scale=Math.min(width,height)*0.40/root.structure.radius*root.zoom
              var projected=[], chainMap={}, chainN=0
              for (var i=0; i<atoms.length; i++) {
                var a=atoms[i]
                if (!root.showLigands && a.het) continue
                var x=a.x*cy+a.z*sy, z=-a.x*sy+a.z*cy
                var y=a.y*cx-z*sx; z=a.y*sx+z*cx
                if (chainMap[a.chain] === undefined) chainMap[a.chain]=chainN++
                projected.push({x:width/2+x*scale, y:height/2-y*scale, z:z, atom:a, color:Molecule.color(a,root.colorScheme,chainMap)})
              }
              ctx.lineCap="round"; ctx.lineJoin="round"
              if (root.renderMode === "cartoon") {
                var ribbons=[], active={}
                for (i=0; i<projected.length; i++) {
                  var rp=projected[i]
                  if (rp.atom.het || (rp.atom.name !== "CA" && rp.atom.name !== "P")) continue
                  var prior=active[rp.atom.chain]
                  var disconnected=true
                  if (prior && prior.points.length) {
                    var pa=prior.points[prior.points.length-1].atom
                    var rdx=rp.atom.x-pa.x, rdy=rp.atom.y-pa.y, rdz=rp.atom.z-pa.z
                    disconnected=Math.sqrt(rdx*rdx+rdy*rdy+rdz*rdz)>5.0
                  }
                  if (!prior || disconnected) {
                    prior={points:[], color:rp.color, depth:0}
                    ribbons.push(prior); active[rp.atom.chain]=prior
                  }
                  prior.points.push(rp); prior.depth+=rp.z
                }
                ribbons.sort(function(a,b){return a.depth/a.points.length-b.depth/b.points.length})
                var ribbonWidth=Math.max(5,Math.min(18,9*root.zoom))
                for (i=0; i<ribbons.length; i++) root.drawCartoonRibbon(ctx,ribbons[i].points,ribbons[i].color,ribbonWidth)
              }
              if (root.renderMode === "backbone" || root.renderMode === "wireframe") {
                var previous={}
                for (i=0; i<projected.length; i++) {
                  var p=projected[i], key=p.atom.chain
                  var eligible=root.renderMode === "wireframe" || p.atom.name === "CA" || p.atom.name === "P"
                  if (!eligible) continue
                  var last=previous[key]
                  if (last) {
                    var ox=p.atom.x-last.atom.x, oy=p.atom.y-last.atom.y, oz=p.atom.z-last.atom.z
                    var molecularDist=Math.sqrt(ox*ox+oy*oy+oz*oz)
                    var maxBond=root.renderMode === "backbone" ? 5.0 : 2.15
                    if (molecularDist <= maxBond) {
                      ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y)
                      ctx.strokeStyle=p.color; ctx.globalAlpha=0.82
                      ctx.lineWidth=root.renderMode === "backbone" ? Math.max(2.5,5*root.zoom) : Math.max(0.7,1.3*root.zoom)
                      ctx.stroke()
                    }
                  }
                  previous[key]=p
                }
              }
              projected.sort(function(a,b){return a.z-b.z})
              ctx.globalAlpha=1
              for (i=0; i<projected.length; i++) {
                p=projected[i]
                var show=root.renderMode === "atoms" || p.atom.het || (root.renderMode === "backbone" && (p.atom.name === "CA" || p.atom.name === "P"))
                if (!show) continue
                var r=root.renderMode === "atoms" ? Math.max(1.2,3.2*root.zoom) : Math.max(1.5,2.4*root.zoom)
                if (p.atom.het) r*=1.45
                ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill()
              }
            }
          }

          MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.LeftButton
            onPressed: function(mouse) { root.lastPointer=Qt.point(mouse.x,mouse.y) }
            onPositionChanged: function(mouse) {
              if (!(mouse.buttons & Qt.LeftButton) || !root.structure) return
              root.rotationY += (mouse.x-root.lastPointer.x)*0.009
              root.rotationX += (mouse.y-root.lastPointer.y)*0.009
              root.lastPointer=Qt.point(mouse.x,mouse.y); viewer.requestPaint()
            }
            onWheel: function(wheel) { root.zoom=Math.max(0.15,Math.min(8,root.zoom*Math.exp(wheel.angleDelta.y/900))); viewer.requestPaint(); wheel.accepted=true }
            onDoubleClicked: { root.rotationX=-0.28; root.rotationY=0.55; root.zoom=1; viewer.requestPaint() }
          }

          DropArea {
            anchors.fill: parent
            onEntered: function(drag) { root.dragActive=true; drag.accept(Qt.CopyAction) }
            onExited: root.dragActive=false
            onDropped: function(drop) {
              root.dragActive=false
              if (drop.urls && drop.urls.length) { root.loadPath(drop.urls[0]); drop.accept(Qt.CopyAction) }
            }
          }

          Column {
            anchors.centerIn: parent; spacing: 14; visible: !root.structure && !root.loading
            Text { anchors.horizontalCenter: parent.horizontalCenter; text: root.dragActive ? "RELEASE TO LOAD" : "DROP A STRUCTURE"; color: root.dragActive ? root.accent : root.foreground; font.family: root.fontFamily; font.pixelSize: 26; font.bold: true; font.letterSpacing: 2 }
            Text { anchors.horizontalCenter: parent.horizontalCenter; text: "PDB · mmCIF"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 14 }
            Rectangle {
              anchors.horizontalCenter: parent.horizontalCenter; width: 148; height: 38; radius: 9; color: root.accent
              Text { anchors.centerIn: parent; text: "CHOOSE FILE"; color: root.background; font.family: root.fontFamily; font.pixelSize: 12; font.bold: true }
              MouseArea { anchors.fill: parent; onClicked: root.openPicker() }
            }
            Text { anchors.horizontalCenter: parent.horizontalCenter; visible: root.errorMessage.length > 0; text: root.errorMessage; color: "#ff6b78"; font.family: root.fontFamily; font.pixelSize: 12 }
          }

          Text { anchors.centerIn: parent; visible: root.loading; text: "READING STRUCTURE…"; color: root.accent; font.family: root.fontFamily; font.pixelSize: 18; font.bold: true }

          Rectangle {
            visible: root.structure !== null
            anchors.left: parent.left; anchors.top: parent.top; anchors.margins: 14
            width: stats.implicitWidth+24; height: stats.implicitHeight+18; radius: 9
            color: Qt.rgba(root.background.r,root.background.g,root.background.b,0.82)
            Text {
              id: stats; anchors.centerIn: parent
              text: root.structure ? root.structure.atomCount.toLocaleString()+" ATOMS  ·  "+root.structure.residueCount.toLocaleString()+" RESIDUES  ·  "+root.structure.chainCount+" CHAINS" : ""
              color: root.foreground; font.family: root.fontFamily; font.pixelSize: 11; font.bold: true
            }
          }
        }

        Rectangle {
          id: picker
          z: 50
          visible: root.filePickerOpen
          anchors.fill: parent
          anchors.margins: 18
          radius: 14
          color: root.background
          border.width: 1
          border.color: root.borderColor

          Column {
            anchors.fill: parent
            anchors.margins: 18
            spacing: 10

            Row {
              width: parent.width
              spacing: 10
              Rectangle {
                width: 42; height: 34; radius: 8
                color: upMouse.containsMouse ? Qt.rgba(root.accent.r, root.accent.g, root.accent.b, 0.18) : "transparent"
                border.width: 1; border.color: root.borderColor
                Text { anchors.centerIn: parent; text: "↑"; color: root.foreground; font.pixelSize: 18 }
                MouseArea {
                  id: upMouse; anchors.fill: parent; hoverEnabled: true
                  onClicked: root.currentFolder = folderModel.parentFolder
                }
              }
              Text {
                width: parent.width - 108; height: 34; verticalAlignment: Text.AlignVCenter
                text: root.localPath(root.currentFolder); color: root.foreground
                font.family: root.fontFamily; font.pixelSize: 12; elide: Text.ElideMiddle
              }
              Rectangle {
                width: 46; height: 34; radius: 8; color: "transparent"
                border.width: 1; border.color: root.borderColor
                Text { anchors.centerIn: parent; text: "ESC"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 10 }
                MouseArea { anchors.fill: parent; onClicked: root.closePicker() }
              }
            }

            ListView {
              id: pickerList
              width: parent.width
              height: parent.height - 44
              clip: true
              model: folderModel
              focus: root.filePickerOpen
              currentIndex: 0
              Keys.onEscapePressed: root.closePicker()
              Keys.onReturnPressed: function() {
                if (currentIndex < 0) return
                if (folderModel.isFolder(currentIndex)) root.currentFolder = folderModel.get(currentIndex, "fileUrl")
                else { root.loadPath(folderModel.get(currentIndex, "fileUrl")); root.closePicker() }
              }
              delegate: Rectangle {
                required property int index
                required property string fileName
                required property url fileUrl
                required property bool fileIsDir
                width: pickerList.width; height: 42; radius: 7
                color: pickerList.currentIndex === index ? Qt.rgba(root.accent.r,root.accent.g,root.accent.b,0.16) : rowMouse.containsMouse ? Qt.rgba(root.foreground.r,root.foreground.g,root.foreground.b,0.06) : "transparent"
                Text { x: 10; anchors.verticalCenter: parent.verticalCenter; text: fileIsDir ? "▸" : "·"; color: fileIsDir ? root.accent : root.muted; font.pixelSize: 16 }
                Text { x: 34; anchors.verticalCenter: parent.verticalCenter; width: parent.width-44; text: fileName; color: root.foreground; font.family: root.fontFamily; font.pixelSize: 13; elide: Text.ElideMiddle }
                MouseArea {
                  id: rowMouse; anchors.fill: parent; hoverEnabled: true
                  onEntered: pickerList.currentIndex = index
                  onClicked: {
                    if (fileIsDir) root.currentFolder = fileUrl
                    else { root.loadPath(fileUrl); root.closePicker() }
                  }
                }
              }
              ScrollBar.vertical: ScrollBar {}
            }
          }
        }

        Row {
          id: footer
          anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
          anchors.leftMargin: 24; anchors.rightMargin: 24; anchors.bottomMargin: 14
          spacing: 20
          Text { text: "DRAG rotate"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 11 }
          Text { text: "SCROLL zoom"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 11 }
          Text { text: "M mode"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 11 }
          Text { text: "C color"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 11 }
          Text { text: "R reset"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 11 }
          Text { text: "ESC close"; color: root.muted; font.family: root.fontFamily; font.pixelSize: 11 }
        }
      }
    }
  }
}
