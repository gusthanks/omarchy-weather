import QtQuick
import Quickshell
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import Quickshell.Io
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
//   gif      scripted demo, one png per change -> $OUT/*.png + $OUT/list.txt (ffmpeg concat)
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
        sourceComponent: shell.mode === "bar" ? barScene
          : shell.mode === "gif" ? gifScene : panelScene
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
    running: shell.capturing && shell.mode !== "gif"
    interval: 1200
    onTriggered: shell.save(shell.stage, shell.out, 2, function() { Qt.quit() })
  }

  // ------------------------------------------------------------ scenes

  // Scripted demo for docs/demo.gif: a rainy afternoon in the popup, the
  // hourly strip scrolled sideways, a location search, then a dry day at the
  // picked place. Mock data only. Each frame is grabbed after the previous one
  // is written, so playback runs at 1000 / frameMs fps however slow the capture;
  // held frames are grabbed once and listed with a longer duration.
  Component {
    id: gifScene
    Rectangle {
      id: scene
      readonly property int pad: Style.spacing.popupPadding
      readonly property int captionHeight: Style.space(44)
      width: Style.space(520) + pad * 2
      // Fixed size for every frame: the tallest state (the search with its
      // suggestions) is measured before the capture starts.
      property real panelMax: 0
      height: panelMax + captionHeight
      color: Commons.Color.background

      MockWeather {
        id: gifMock
        scenario: "rain"
        locationState: ({ name: "Porto", latitude: 41.15, longitude: -8.61 })
      }

      Rectangle {
        id: gifFrame
        y: scene.captionHeight
        width: parent.width
        height: gifView.contentImplicitHeight + scene.pad * 2
        color: Commons.Color.background
        border.width: Math.max(1, Style.space(2))
        border.color: Commons.Color.popups.border
        radius: Style.cornerRadius

        W.WeatherView {
          id: gifView
          x: scene.pad
          y: scene.pad
          width: Style.space(520)
          height: contentImplicitHeight
          weather: gifMock
        }
      }

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.verticalCenter: parent.top
        anchors.verticalCenterOffset: scene.captionHeight / 2
        text: scene.caption
        color: Qt.darker(Commons.Color.foreground, 1.4)
        font.family: Style.font.family
        font.pixelSize: Style.font.body
      }
      property string caption: ""

      property int frame: 0
      readonly property int frameMs: 100
      readonly property int total: 96

      function maxScroll() {
        var s = gifView.hourlyStrip
        return Math.max(0, s.contentWidth - s.width)
      }
      function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 }

      // Returns false when frame f looks like the one before (a hold): it is
      // not grabbed again, the previous shot just lasts one frame longer.
      function step(f) {
        var strip = gifView.hourlyStrip
        if (f === 0) scene.caption = "will it rain, when, and how much?"
        else if (f >= 14 && f <= 30) { scene.caption = "the next 24 hours, hour by hour"; strip.contentX = maxScroll() * ease((f - 14) / 16) }
        else if (f >= 36 && f <= 44) strip.contentX = maxScroll() * (1 - ease((f - 36) / 8))
        else if (f === 48) { scene.caption = "search any place"; gifMock.locationSuggestions = []; gifMock.editingLocation = true; gifView.locationField.text = "" }
        else if (f === 52) gifView.locationField.text = "L"
        else if (f === 54) gifView.locationField.text = "Li"
        else if (f === 56) { gifView.locationField.text = "Lis"; gifMock.suggestionIndex = 0; gifMock.locationSuggestions = scene.suggestions }
        else if (f === 62) gifMock.suggestionIndex = 1
        else if (f === 65) gifMock.suggestionIndex = 0
        else if (f === 70) { gifMock.pickSuggestion(scene.suggestions[0]); gifMock.scenario = "dry"; scene.caption = "a dry day says so" }
        else return false
        return true
      }

      property var suggestions: []

      function pad4(n) { var s = String(n); while (s.length < 4) s = "0" + s; return s }

      // shots: [file, frames it lasts], written as an ffmpeg concat list.
      property var shots: []

      function next() {
        if (scene.frame >= scene.total) {
          var list = ""
          for (var i = 0; i < shots.length; i++)
            list += "file '" + shots[i][0] + "'\nduration " + (shots[i][1] * scene.frameMs / 1000) + "\n"
          if (shots.length) list += "file '" + shots[shots.length - 1][0] + "'\n"
          listFile.setText(list)
          Qt.callLater(Qt.quit)
          return
        }
        var f = scene.frame
        scene.frame++
        if (!scene.step(f) && shots.length) {
          shots[shots.length - 1][1]++
          Qt.callLater(scene.next)
          return
        }
        var name = scene.pad4(f) + ".png"
        shots.push([name, 1])
        // Let bindings and the strip's scroll animation settle before the grab.
        settle.file = name
        settle.restart()
      }

      Timer {
        id: settle
        property string file: ""
        interval: 220
        onTriggered: shell.save(scene, shell.out + "/" + file, 1, function() { scene.next() })
      }

      // Measure the tallest state (search with suggestions), then start.
      Component.onCompleted: gifMock.editingLocation = true
      Timer {
        running: true
        interval: 600
        onTriggered: {
          scene.suggestions = gifMock.locationSuggestions
          scene.panelMax = gifFrame.height
          gifMock.editingLocation = false
          start.start()
        }
      }
      Timer { id: start; interval: 600; onTriggered: scene.next() }

      FileView { id: listFile; path: shell.out + "/list.txt"; printErrors: false }
    }
  }
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
