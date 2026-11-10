import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// The popup's content. Everything it shows comes from `weather` (Panel.qml in
// the shell, a mock in dev/Harness.qml), so it can be rendered on its own.
Flickable {
  id: view

  // Panel.qml (or the dev harness mock): data, strings and actions.
  required property var weather
  property alias locationField: locationField
  property alias hourlyStrip: hourlyFlick
  readonly property real contentImplicitHeight: weatherColumn.implicitHeight

  contentWidth: width
  contentHeight: weatherColumn.implicitHeight
  clip: true
  boundsBehavior: Flickable.StopAtBounds
  flickableDirection: Flickable.VerticalFlick
  interactive: contentHeight > height

  // One cell of the stats grid: icon + caption over a value.
  component Stat: Column {
    id: stat
    property var bar: null
    property real cellWidth: 0
    property string icon: ""
    property string title: ""
    property string value: ""
    width: cellWidth
    spacing: Style.space(3)

    Row {
      spacing: Style.space(4)
      Text {
        textFormat: Text.PlainText
        text: stat.icon
        color: Qt.darker(stat.bar.foreground, 1.4)
        font.family: stat.bar.fontFamily
        font.pixelSize: Style.font.caption
        anchors.verticalCenter: parent.verticalCenter
      }
      Text {
        textFormat: Text.PlainText
        text: stat.title
        color: Qt.darker(stat.bar.foreground, 1.5)
        font.family: stat.bar.fontFamily
        font.pixelSize: Style.font.caption
        font.letterSpacing: 1
        anchors.verticalCenter: parent.verticalCenter
      }
    }

    Text {
      textFormat: Text.PlainText
      text: stat.value !== "" ? stat.value : "—"
      color: stat.bar.foreground
      font.family: stat.bar.fontFamily
      font.pixelSize: Style.font.title
    }
  }

  Column {
    id: weatherColumn
    width: view.width
    spacing: Style.space(12)

    // ---- Header: Location (top left)
    Item {
      width: parent.width
      implicitHeight: Math.max(locationRow.implicitHeight, locationEditRow.implicitHeight)
      height: implicitHeight

      Row {
        id: locationRow
        anchors.left: parent.left
        anchors.leftMargin: Style.space(16)
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(6)
        visible: !view.weather.editingLocation && view.weather.reportLocation !== ""

        TapHandler {
          onTapped: view.weather.startEditingLocation()
        }
        HoverHandler {
          cursorShape: Qt.PointingHandCursor
        }

        Text {
          text: ""  // nf-fa-map_marker
          color: Qt.darker(view.weather.bar.foreground, 1.4)
          font.family: view.weather.bar.fontFamily
          font.pixelSize: Style.font.bodySmall
          anchors.verticalCenter: parent.verticalCenter
        }
        Text {
          textFormat: Text.PlainText
          text: (view.weather.reportLocation || "").toUpperCase()
          color: Qt.darker(view.weather.bar.foreground, 1.4)
          font.family: view.weather.bar.fontFamily
          font.pixelSize: Style.font.bodySmall
          font.letterSpacing: 1
          anchors.verticalCenter: parent.verticalCenter
        }
      }

      Row {
        id: locationEditRow
        visible: view.weather.editingLocation
        anchors.left: parent.left
        anchors.leftMargin: Style.space(16)
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(6)

        TextField {
          id: locationField
          width: Style.space(220)
          enabled: !view.weather.savingLocation
          placeholderText: view.weather.tr("weather.searchCity")
          foreground: view.weather.bar.foreground
          font.family: view.weather.bar.fontFamily

          onTextChanged: if (view.weather.editingLocation && !view.weather.savingLocation) view.weather.locationTextEdited()

          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Escape) {
              view.weather.cancelEditingLocation()
              event.accepted = true
            } else if (event.key === Qt.Key_Down) {
              if (view.weather.suggestionIndex < view.weather.locationSuggestions.length - 1) view.weather.suggestionIndex++
              event.accepted = true
            } else if (event.key === Qt.Key_Up) {
              if (view.weather.suggestionIndex > 0) view.weather.suggestionIndex--
              event.accepted = true
            } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
              view.weather.commitLocation()
              event.accepted = true
            }
          }
        }

        Rectangle {
          width: Style.space(18)
          height: Style.space(18)
          anchors.verticalCenter: parent.verticalCenter
          radius: Math.min(4, Style.cornerRadius)
          color: !view.weather.savingLocation && clearLocationArea.containsMouse ? Style.hoverFillFor(view.weather.bar.foreground, Commons.Color.accent) : "transparent"

          Text {
            textFormat: Text.PlainText
            anchors.centerIn: parent
            text: view.weather.savingLocation ? "󰦖" : "✕"
            font.family: view.weather.bar.fontFamily
            color: Qt.darker(view.weather.bar.foreground, 1.4)
            font.pixelSize: Style.font.bodySmall

            RotationAnimator on rotation {
              running: view.weather.savingLocation && !Style.reduceMotion
              from: 0; to: 360
              duration: Style.duration(800)
              loops: Animation.Infinite
            }
          }

          MouseArea {
            id: clearLocationArea
            anchors.fill: parent
            enabled: !view.weather.savingLocation
            hoverEnabled: true
            cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: view.weather.clearLocation()
          }
        }
      }
    }

    // ---- Hero row: big icon + temp on the left; stats grid on the right.
    Item {
      width: parent.width
      implicitHeight: Math.max(heroLeft.height, heroRight.height)
      height: implicitHeight

      Row {
        id: heroLeft
        anchors.left: parent.left
        anchors.leftMargin: Style.space(16)
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(14)

        Text {
          id: heroIcon
          textFormat: Text.PlainText
          anchors.verticalCenter: parent.verticalCenter
          text: view.weather.label || "—"
          color: view.weather.bar.foreground
          font.family: view.weather.bar.fontFamily
          font.pixelSize: 54
        }

        Column {
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(3)

          Row {
            spacing: Style.space(2)
            LayoutMirroring.enabled: false

            Text {
              id: tempBig
              textFormat: Text.PlainText
              text: view.weather.reportTempNum || "—"
              color: view.weather.bar.foreground
              font.family: view.weather.bar.fontFamily
              font.pixelSize: 50
              font.bold: true
            }
            Text {
              textFormat: Text.PlainText
              text: view.weather.current ? view.weather.tempUnit : ""
              color: view.weather.bar.foreground
              font.family: view.weather.bar.fontFamily
              font.pixelSize: Style.font.title
              anchors.top: tempBig.top
              anchors.topMargin: Style.space(8)
            }
          }

          Row {
            visible: view.weather.todayMax !== "" && view.weather.todayMin !== ""
            spacing: Style.space(8)

            Text {
              textFormat: Text.PlainText
              text: "↑ " + view.weather.todayMax + "°"
              color: view.weather.bar.foreground
              font.family: view.weather.bar.fontFamily
              font.pixelSize: Style.font.bodySmall
              font.bold: true
              opacity: 0.95
            }
            Text {
              textFormat: Text.PlainText
              text: "↓ " + view.weather.todayMin + "°"
              color: Qt.darker(view.weather.bar.foreground, 1.4)
              font.family: view.weather.bar.fontFamily
              font.pixelSize: Style.font.bodySmall
            }
          }
        }
      }

      Column {
        id: heroRight
        anchors.right: parent.right
        anchors.rightMargin: Style.space(16)
        anchors.verticalCenter: parent.verticalCenter
        width: weatherStats.implicitWidth

        Column {
          id: weatherStats
          visible: !!view.weather.current
          spacing: Style.space(12)
          anchors.right: parent.right

          Row {
            spacing: Style.space(12)
            anchors.right: parent.right
            Stat { bar: view.weather.bar; cellWidth: Style.space(80); icon: "󰔏"; title: view.weather.tr("weather.feels"); value: view.weather.reportFeels }
            Stat { bar: view.weather.bar; cellWidth: Style.space(84); icon: "󰖝"; title: view.weather.tr("weather.wind"); value: view.weather.reportWind }
            Stat { bar: view.weather.bar; cellWidth: Style.space(84); icon: "󰖌"; title: view.weather.tr("weather.humid"); value: view.weather.reportHumidity }
          }

          Row {
            visible: view.weather.reportUv !== "" || view.weather.reportSunrise !== ""
            spacing: Style.space(12)
            anchors.right: parent.right
            Stat { bar: view.weather.bar; cellWidth: Style.space(80); icon: "󰖙"; title: view.weather.tr("weather.uv"); value: view.weather.reportUv }
            Stat { bar: view.weather.bar; cellWidth: Style.space(84); icon: "󰖜"; title: view.weather.tr("weather.sunrise"); value: view.weather.reportSunrise }
            Stat { bar: view.weather.bar; cellWidth: Style.space(84); icon: "󰖛"; title: view.weather.tr("weather.sunset"); value: view.weather.reportSunset }
          }
        }
      }
    }

    // ---- Geocoding suggestions while the location is being edited.
    Column {
      visible: view.weather.editingLocation && !view.weather.savingLocation && view.weather.locationSuggestions.length > 0
      width: parent.width
      spacing: 0

      Repeater {
        model: view.weather.locationSuggestions

        Rectangle {
          required property var modelData
          required property int index
          width: parent.width
          height: suggestionRow.implicitHeight + Style.space(12)
          radius: Style.cornerRadius
          color: index === view.weather.suggestionIndex ? Style.hoverFillFor(view.weather.bar.foreground, Commons.Color.accent) : "transparent"

          Row {
            id: suggestionRow
            anchors.left: parent.left
            anchors.leftMargin: Style.space(16)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(8)

            Text {
              textFormat: Text.PlainText
              text: modelData.name
              color: index === view.weather.suggestionIndex ? Style.hoverStateColor(view.weather.bar.foreground, Commons.Color.accent) : view.weather.bar.foreground
              font.family: view.weather.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              textFormat: Text.PlainText
              visible: text !== ""
              text: modelData.description
              color: Qt.darker(view.weather.bar.foreground, 1.5)
              font.family: view.weather.bar.fontFamily
              font.pixelSize: Style.font.bodySmall
              anchors.verticalCenter: parent.verticalCenter
            }
          }

          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onPositionChanged: view.weather.suggestionIndex = index
            onClicked: view.weather.pickSuggestion(modelData)
          }
        }
      }
    }

    Text {
      visible: !view.weather.current
      text: view.weather.tr("weather.fetching")
      textFormat: Text.PlainText
      color: Qt.darker(view.weather.bar.foreground, 1.5)
      font.family: view.weather.bar.fontFamily
      font.pixelSize: Style.font.bodySmall
      font.italic: true
    }

    // ---- Divider between current conditions and hourly forecast.
    Rectangle {
      visible: view.weather.hourlyForecast.length > 0 || view.weather.forecastDays.length > 0
      width: parent.width
      height: Style.spacing.hairline
      color: view.weather.bar.foreground
      opacity: 0.12
    }

    // ---- Rain Summary Banner/Pill
    Rectangle {
      id: rainBanner
      visible: view.weather.hourlyForecast.length > 0 && view.weather.rainSummary.text !== ""
      width: parent.width - Style.space(32)
      anchors.horizontalCenter: parent.horizontalCenter
      height: Style.space(34)
      radius: Style.cornerRadius
      color: view.weather.rainSummary.hasRain
        ? Qt.rgba(56 / 255, 189 / 255, 248 / 255, 0.12)
        : Qt.rgba(view.weather.bar.foreground.r, view.weather.bar.foreground.g, view.weather.bar.foreground.b, 0.05)
      border.width: 1
      border.color: view.weather.rainSummary.hasRain
        ? Qt.rgba(56 / 255, 189 / 255, 248 / 255, 0.28)
        : Qt.rgba(view.weather.bar.foreground.r, view.weather.bar.foreground.g, view.weather.bar.foreground.b, 0.08)

      Row {
        anchors.centerIn: parent
        spacing: Style.space(8)

        Text {
          textFormat: Text.PlainText
          text: view.weather.rainSummary.icon
          color: view.weather.rainSummary.hasRain ? "#38bdf8" : Qt.darker(view.weather.bar.foreground, 1.4)
          font.family: view.weather.bar.fontFamily
          font.pixelSize: Style.font.body
          anchors.verticalCenter: parent.verticalCenter
        }

        Text {
          textFormat: Text.PlainText
          text: view.weather.rainSummary.text
          color: view.weather.rainSummary.hasRain ? view.weather.bar.foreground : Qt.darker(view.weather.bar.foreground, 1.3)
          font.family: view.weather.bar.fontFamily
          font.pixelSize: Style.font.bodySmall
          font.bold: view.weather.rainSummary.hasRain
          anchors.verticalCenter: parent.verticalCenter
        }
      }
    }

    // ---- Hourly forecast horizontal strip
    Flickable {
      id: hourlyFlick
      visible: view.weather.hourlyForecast.length > 0
      width: parent.width
      height: Style.space(122)
      contentWidth: hourlyRow.implicitWidth + Style.space(32)
      contentHeight: height
      clip: true
      boundsBehavior: Flickable.StopAtBounds
      flickableDirection: Flickable.HorizontalFlick

      Behavior on contentX {
        enabled: !dragHandler.active
        NumberAnimation {
          duration: 160
          easing.type: Easing.OutCubic
        }
      }

      WheelHandler {
        target: hourlyFlick
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        onWheel: function(event) {
          var dx = 0
          if (event.pixelDelta.x !== 0) {
            dx = -event.pixelDelta.x
          } else if (event.angleDelta.x !== 0) {
            dx = -(event.angleDelta.x / 120) * Style.space(80)
          } else if (event.pixelDelta.y !== 0) {
            dx = -event.pixelDelta.y
          } else if (event.angleDelta.y !== 0) {
            dx = -(event.angleDelta.y / 120) * Style.space(80)
          }

          if (dx !== 0) {
            var maxScroll = Math.max(0, hourlyFlick.contentWidth - hourlyFlick.width)
            hourlyFlick.contentX = Math.max(0, Math.min(maxScroll, hourlyFlick.contentX + dx))
          }
          event.accepted = true
        }
      }

      DragHandler {
        id: dragHandler
        target: null
        xAxis.enabled: true
        yAxis.enabled: false
        cursorShape: Qt.PointingHandCursor
        property real startContentX: 0
        onActiveChanged: {
          if (active) startContentX = hourlyFlick.contentX
        }
        onTranslationChanged: {
          if (active) {
            var maxScroll = Math.max(0, hourlyFlick.contentWidth - hourlyFlick.width)
            hourlyFlick.contentX = Math.max(0, Math.min(maxScroll, startContentX - translation.x))
          }
        }
      }

      Row {
        id: hourlyRow
        anchors.verticalCenter: parent.verticalCenter
        anchors.left: parent.left
        anchors.leftMargin: Style.space(16)
        spacing: Style.space(6)

        Repeater {
          model: view.weather.hourlyForecast

          Rectangle {
            required property var modelData
            required property int index
            width: Style.space(62)
            height: Style.space(116)
            radius: Style.cornerRadius
            color: modelData.isNow ? Style.hoverFillFor(view.weather.bar.foreground, Commons.Color.accent) : "transparent"
            border.width: modelData.isNow ? 1 : 0
            border.color: modelData.isNow ? Qt.rgba(view.weather.bar.foreground.r, view.weather.bar.foreground.g, view.weather.bar.foreground.b, 0.18) : "transparent"

            Column {
              anchors.top: parent.top
              anchors.topMargin: Style.space(8)
              anchors.horizontalCenter: parent.horizontalCenter
              spacing: Style.space(3)

              Text {
                textFormat: Text.PlainText
                anchors.horizontalCenter: parent.horizontalCenter
                text: modelData.hourLabel
                color: modelData.isNow ? view.weather.bar.foreground : Qt.darker(view.weather.bar.foreground, 1.4)
                font.family: view.weather.bar.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: modelData.isNow
              }

              Text {
                textFormat: Text.PlainText
                anchors.horizontalCenter: parent.horizontalCenter
                text: modelData.icon
                color: view.weather.bar.foreground
                font.family: view.weather.bar.fontFamily
                font.pixelSize: Style.font.title
              }

              Text {
                textFormat: Text.PlainText
                anchors.horizontalCenter: parent.horizontalCenter
                text: (view.weather.useImperial ? modelData.tempF : modelData.tempC) + "°"
                color: view.weather.bar.foreground
                font.family: view.weather.bar.fontFamily
                font.pixelSize: Style.font.bodySmall
                font.bold: true
              }
            }

            Column {
              anchors.bottom: parent.bottom
              anchors.bottomMargin: Style.space(8)
              anchors.horizontalCenter: parent.horizontalCenter
              spacing: Style.space(3)

              Text {
                textFormat: Text.PlainText
                anchors.horizontalCenter: parent.horizontalCenter
                visible: modelData.precipitationProbability > 0
                text: modelData.precipitationProbability + "%"
                color: modelData.precipitationProbability >= 40 ? "#38bdf8" : Qt.darker(view.weather.bar.foreground, 1.4)
                font.family: view.weather.bar.fontFamily
                font.pixelSize: Style.font.caption - 1
                font.bold: modelData.precipitationProbability >= 40
              }

              Item {
                anchors.horizontalCenter: parent.horizontalCenter
                width: Style.space(22)
                height: Style.space(12)

                Rectangle {
                  anchors.bottom: parent.bottom
                  anchors.horizontalCenter: parent.horizontalCenter
                  width: parent.width
                  height: 2
                  radius: 1
                  color: Qt.rgba(view.weather.bar.foreground.r, view.weather.bar.foreground.g, view.weather.bar.foreground.b, 0.12)
                }

                Rectangle {
                  anchors.bottom: parent.bottom
                  anchors.horizontalCenter: parent.horizontalCenter
                  width: Style.space(14)
                  height: Math.max(2, Math.round(12 * Math.min(100, Math.max(0, modelData.precipitationProbability)) / 100))
                  radius: 2
                  color: modelData.precipitationProbability > 0
                    ? "#38bdf8"
                    : Qt.rgba(view.weather.bar.foreground.r, view.weather.bar.foreground.g, view.weather.bar.foreground.b, 0.08)
                }
              }
            }
          }
        }
      }
    }

    // ---- Divider between hourly and daily forecast.
    Rectangle {
      visible: view.weather.forecastDays.length > 0 && view.weather.hourlyForecast.length > 0
      width: parent.width
      height: Style.spacing.hairline
      color: view.weather.bar.foreground
      opacity: 0.12
    }

    // ---- Forecast row: each cell has the day icon left of a day-name + hi/lo column.
    //      Wrapped in an Item so the block of cells can be centered within the popup.
    Item {
      visible: view.weather.forecastDays.length > 0
      width: parent.width
      implicitHeight: forecastRow.height + Style.space(4)
      height: implicitHeight

      Row {
        id: forecastRow
        anchors.centerIn: parent
        spacing: Style.space(36)

        Repeater {
          model: view.weather.forecastDays

          Row {
            required property var modelData
            required property int index
            spacing: Style.space(10)

            Text {
              textFormat: Text.PlainText
              anchors.verticalCenter: parent.verticalCenter
              text: view.weather.dayIcon(modelData)
              color: view.weather.bar.foreground
              font.family: view.weather.bar.fontFamily
              font.pixelSize: Style.font.display
            }

            Column {
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(2)

              Text {
                textFormat: Text.PlainText
                text: view.weather.dayName(modelData.date).toUpperCase()
                color: Qt.darker(view.weather.bar.foreground, 1.4)
                font.family: view.weather.bar.fontFamily
                font.pixelSize: Style.font.caption
                font.letterSpacing: 1
              }

              Row {
                spacing: Style.space(6)

                Text {
                  textFormat: Text.PlainText
                  text: view.weather.bareTempForDay(modelData, "max")
                  color: view.weather.bar.foreground
                  font.family: view.weather.bar.fontFamily
                  font.pixelSize: Style.font.body
                }
                Text {
                  textFormat: Text.PlainText
                  text: view.weather.bareTempForDay(modelData, "min")
                  color: Qt.darker(view.weather.bar.foreground, 1.5)
                  font.family: view.weather.bar.fontFamily
                  font.pixelSize: Style.font.body
                }
              }
            }
          }
        }
      }
    }

    // ---- Divider between daily forecast and radar button
    Rectangle {
      visible: view.weather.forecastDays.length > 0
      width: parent.width - Style.space(32)
      anchors.horizontalCenter: parent.horizontalCenter
      height: Style.spacing.hairline
      color: view.weather.bar.foreground
      opacity: 0.12
    }

    // ---- Live Radar Link/Button
    Item {
      width: parent.width
      implicitHeight: Style.space(26)
      height: implicitHeight

      Rectangle {
        id: radarBtn
        anchors.centerIn: parent
        implicitWidth: radarRow.implicitWidth + Style.space(16)
        implicitHeight: Style.space(24)
        width: implicitWidth
        height: implicitHeight
        radius: Style.cornerRadius
        color: radarMouse.containsMouse
          ? Style.hoverFillFor(view.weather.bar.foreground, Commons.Color.accent)
          : "transparent"

        Row {
          id: radarRow
          anchors.centerIn: parent
          spacing: Style.space(6)

          Text {
            textFormat: Text.PlainText
            text: "󰈹"
            color: radarMouse.containsMouse ? Commons.Color.accent : Qt.darker(view.weather.bar.foreground, 1.4)
            font.family: view.weather.bar.fontFamily
            font.pixelSize: Style.font.bodySmall
            anchors.verticalCenter: parent.verticalCenter
          }

          Text {
            textFormat: Text.PlainText
            text: view.weather.tr("weather.openRadar")
            color: radarMouse.containsMouse ? view.weather.bar.foreground : Qt.darker(view.weather.bar.foreground, 1.4)
            font.family: view.weather.bar.fontFamily
            font.pixelSize: Style.font.caption
            font.underline: radarMouse.containsMouse
            anchors.verticalCenter: parent.verticalCenter
          }
        }

        MouseArea {
          id: radarMouse
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: view.weather.openRadar()
        }
      }
    }
  }
}
