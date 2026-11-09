import QtQuick
import qs.Commons

// The imminent-rain marker drawn over the bar pill's top-right corner.
Rectangle {
  enabled: false
  width: Style.space(6)
  height: Style.space(6)
  radius: width / 2
  color: "#38bdf8"
  border.width: 1
  border.color: Qt.rgba(0, 0, 0, 0.35)
  anchors.topMargin: Style.space(4)
  anchors.rightMargin: Style.space(4)
  z: 10
}
