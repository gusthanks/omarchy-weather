import QtQuick
import Quickshell
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "weather" as W

// Isolated dev harness. Runs in its own Quickshell instance (see dev/run.sh),
// never inside the live Omarchy shell, so testing and screenshots do not
// reload or restart the user's bar. All data is MOCK (dev/mock/*.json).
//
// MODE (env):
//   preview  floating window with the popup content, to play with
//   panel    the popup with the rainy mock          -> $OUT (png)
//   dry      the popup with the dry mock            -> $OUT (png)
//   search   the popup while searching a location  -> $OUT (png)
//   bar      the bar pill with the imminent-rain dot -> $OUT (png)
ShellRoot {
  id: shell

  readonly property string mode: Quickshell.env("MODE") || "preview"
  readonly property string out: Quickshell.env("OUT") || ""
  readonly property bool capturing: mode !== "preview"
  readonly property bool headless: Quickshell.env("HEADLESS") === "1"
  property Item stage: null

  function save(item, path, scale, done) {
    item.grabToImage(function(r) {
      r.saveToFile(path)
      if (done) done()
    }, Qt.size(item.width * scale, item.height * scale))
  }

  Component {
    id: stageComponent
    Rectangle {
      id: stageRect
      color: Commons.Color.background
      width: loader.item ? loader.item.width : 10
      height: loader.item ? loader.item.height : 10
      Component.onCompleted: shell.stage = stageRect

      Loader {
        id: loader
        sourceComponent: shell.mode === "bar" ? barScene : panelScene
      }
    }
  }

  // HEADLESS=1 (the dev/run.sh default): Qt's offscreen platform, nothing
  // reaches the desktop. Otherwise a background-layer surface below every
  // window. LayerStage is its own file: offscreen has no PanelWindow backend.
  LazyLoader {
    active: shell.capturing && !shell.headless
    source: "LayerStage.qml"
    onItemChanged: if (item) item.content = stageComponent
  }

  FloatingWindow {
    visible: !shell.capturing || shell.headless
    implicitWidth: offLoader.item ? offLoader.item.width : 10
    implicitHeight: offLoader.item ? offLoader.item.height : 10
    color: "transparent"
    Loader { id: offLoader; active: !shell.capturing || shell.headless; sourceComponent: stageComponent }
  }

  Timer {
    running: shell.capturing
    interval: 1200
    onTriggered: shell.save(shell.stage, shell.out, 2, function() { Qt.quit() })
  }

  // ------------------------------------------------------------ scenes
  // The popup: WeatherView inside a frame shaped like the shell's popups.
  Component {
    id: panelScene
    Rectangle {
      id: frame
      readonly property int pad: Style.spacing.popupPadding
      width: Style.space(520) + pad * 2
      height: view.contentImplicitHeight + pad * 2
      color: Commons.Color.background
      border.width: Math.max(1, Style.space(2))
      border.color: Commons.Color.popups.border
      radius: Style.cornerRadius

      MockWeather {
        id: mock
        scenario: shell.mode === "dry" ? "dry" : "rain"
        editingLocation: shell.mode === "search"
      }

      W.WeatherView {
        id: view
        x: frame.pad
        y: frame.pad
        width: Style.space(520)
        height: contentImplicitHeight
        weather: mock
        Component.onCompleted: if (shell.mode === "search") locationField.text = "Lis"
      }
    }
  }

  // The bar pill next to a clock, as it sits in the bar; the blue dot marks
  // likely rain in the next hours.
  Component {
    id: barScene
    Rectangle {
      width: barRow.implicitWidth + Style.space(24)
      height: Style.bar.sizeHorizontal
      color: Commons.Color.background

      MockWeather { id: barMock; scenario: "rain" }

      Row {
        id: barRow
        anchors.centerIn: parent
        spacing: Style.space(12)

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: "Monday 15 Jun 2:00 PM"
          color: Commons.Color.foreground
          font.family: Style.font.family
          font.pixelSize: Style.bar.iconFont
        }

        Item {
          anchors.verticalCenter: parent.verticalCenter
          implicitWidth: pill.implicitWidth
          implicitHeight: pill.implicitHeight
          width: implicitWidth
          height: implicitHeight

          BarIconButton {
            id: pill
            anchors.fill: parent
            bar: barMock.bar
            text: barMock.label
            slotSize: Style.bar.statusSlot
          }
          W.RainDot {
            visible: barMock.hasImminentRain
            anchors.top: parent.top
            anchors.right: parent.right
          }
        }
      }
    }
  }
}
