type Locale = 'en' | 'de' | 'vi';
const messages: Record<string, { de: string; vi: string }> = {
  'Wait for your turn.': { de: 'Warte, bis du an der Reihe bist.', vi: 'Hãy chờ đến lượt của bạn.' },
  'That turn or market selection is stale.': { de: 'Der Spielzug hat sich geändert. Wähle erneut aus dem aktuellen Markt.', vi: 'Lượt hoặc chợ đã thay đổi. Hãy chọn lại từ chợ hiện tại.' },
  'That landscape tile is no longer offered.': { de: 'Dieses Plättchen ist nicht mehr im Markt. Wähle ein anderes.', vi: 'Ô này không còn trong chợ. Hãy chọn một ô khác.' },
  'All eight Survey Markers are already deployed.': { de: 'Alle acht Vermessungsmarker liegen bereits auf der Karte. Wähle „Kein Marker“.', vi: 'Cả tám Dấu Khảo sát đã được sử dụng. Hãy chọn không đặt dấu.' },
  'Route Survey needs a Trail or Stream tile.': { de: 'Eine Routenvermessung braucht ein Plättchen mit Pfad oder Bach.', vi: 'Khảo sát tuyến đường cần ô có Đường mòn hoặc Suối.' },
  'That map location is occupied.': { de: 'Hier liegt bereits ein Plättchen. Wähle ein freies Randfeld.', vi: 'Vị trí này đã có ô. Hãy chọn một ô trống cạnh bản đồ.' },
  'Place beside an existing tile, along an edge.': { de: 'Lege das Plättchen an eine Kante der vorhandenen Landschaft.', vi: 'Đặt ô kề một cạnh của ô đã có trên bản đồ.' },
  'This match has finished.': { de: 'Diese Partie ist beendet. Der Gastgeber kann eine neue starten.', vi: 'Ván này đã kết thúc. Chủ bàn có thể bắt đầu ván mới.' },
  'The table changed. Review the latest state.': { de: 'Der Tisch hat sich geändert. Prüfe den aktuellen Spielstand.', vi: 'Bàn chơi đã thay đổi. Hãy kiểm tra trạng thái mới nhất.' },
  'That action belongs to a previous match.': { de: 'Dieser Zug gehört zur vorherigen Partie. Wähle deinen Zug erneut.', vi: 'Nước đi này thuộc ván trước. Hãy chọn lại nước đi trong ván hiện tại.' },
  'A newer tab controls this seat.': { de: 'Ein neuerer Browser-Tab steuert diesen Platz. Spiele dort weiter oder lade diesen Tab neu.', vi: 'Một thẻ trình duyệt mới hơn đang điều khiển ghế này. Chơi tại thẻ đó hoặc tải lại thẻ này.' },
  'That action was malformed.': { de: 'Der Zug konnte nicht gelesen werden. Lade den Tisch neu und versuche es erneut.', vi: 'Không thể đọc nước đi này. Tải lại bàn chơi rồi thử lại.' },
  'Only the host can start.': { de: 'Nur der Gastgeber kann die Partie starten.', vi: 'Chỉ chủ bàn mới có thể bắt đầu ván.' },
  'Only the host can begin a rematch.': { de: 'Nur der Gastgeber kann eine neue Partie starten.', vi: 'Chỉ chủ bàn mới có thể bắt đầu ván mới.' },
  'Reconnect every Away player or explicitly replace their seat with a bot.': { de: 'Alle Abwesenden müssen sich verbinden oder vom Gastgeber durch Bots ersetzt werden.', vi: 'Mọi người đang vắng mặt cần kết nối lại hoặc được chủ bàn thay bằng máy.' },
  'Wait for every player to connect or replace an Away player with a bot.': { de: 'Warte auf alle Mitspielenden oder ersetze abwesende Personen durch Bots.', vi: 'Chờ mọi người kết nối hoặc thay người đang vắng mặt bằng máy.' },
  'Use whole-number map coordinates.': { de: 'Verwende ganzzahlige Kartenkoordinaten.', vi: 'Tọa độ bản đồ phải là số nguyên.' },
  'Choose one of four tile orientations.': { de: 'Wähle eine der vier Plättchenausrichtungen.', vi: 'Chọn một trong bốn hướng xoay ô.' },
  'Choose Habitat Survey, Route Survey, or no marker.': { de: 'Wähle Lebensraumvermessung, Routenvermessung oder keinen Marker.', vi: 'Chọn khảo sát sinh cảnh, khảo sát tuyến đường hoặc không đặt dấu.' },
  'Only the server can time out a turn.': { de: 'Nur der Server kann einen abgelaufenen Zug abschließen.', vi: 'Chỉ máy chủ mới có thể xử lý lượt hết thời gian.' },
};
export function localizeWildwaysError(message: string, locale: Locale): string {
  return locale === 'en' ? message : messages[message]?.[locale] ?? message;
}