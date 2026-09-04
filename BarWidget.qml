import QtQuick
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
    text: "P"
    fontFamily: root.bar ? root.bar.fontFamily : "monospace"
    horizontalMargin: 8
    tooltipText: "ProtOmaView"
    onPressed: function(buttonCode) {
      if (!root.bar || buttonCode !== Qt.LeftButton) return
      root.bar.run("omarchy-shell shell toggle io.github.samplebias.protomaview '{}'")
    }
  }
}
