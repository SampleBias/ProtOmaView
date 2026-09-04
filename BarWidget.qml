import QtQuick
import QtQuick.Effects
import qs.Ui

BarWidget {
  id: root
  moduleName: "io.github.samplebias.protomaview"

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: ""
    labelVisible: false
    hasVisualContent: true
    keepSpace: true
    fixedWidth: 26
    horizontalMargin: 8
    tooltipText: "ProtOmaView"

    Image {
      id: iconSource
      anchors.centerIn: parent
      width: 20
      height: 20
      visible: false
      fillMode: Image.PreserveAspectFit
      source: Qt.resolvedUrl("assets/protomaview-icon.png")
      sourceSize.width: 64
      sourceSize.height: 64
    }

    MultiEffect {
      anchors.fill: iconSource
      source: iconSource
      colorization: 1
      colorizationColor: button.foreground
    }

    onPressed: function(buttonCode) {
      if (!root.bar || buttonCode !== Qt.LeftButton) return
      root.bar.run("omarchy-shell shell toggle io.github.samplebias.protomaview '{}'")
    }
  }
}
