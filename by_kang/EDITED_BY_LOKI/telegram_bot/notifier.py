"""
Telegram Bot Notifier - 거래 신호 및 위험 상태 알림
"""

import requests
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


logger = logging.getLogger(__name__)


class AlertType(Enum):
    """알람 유형"""
    BUY_SIGNAL = "🟢 매수 신호"
    SELL_SIGNAL = "🔴 매도 신호"
    HOLD = "🟡 대기"
    CRITICAL_LOSS = "⚠️ 긴급 손실"
    OVERHEATING = "🔥 과열 경고"
    PORTFOLIO_UPDATE = "📊 포트폴리오 업데이트"


class TelegramNotifier:
    """Telegram API를 사용한 알림 발송"""

    def __init__(self, token: str, chat_id: str, enabled: bool = True):
        """
        Args:
            token: 텔레그램 봇 토큰
            chat_id: 수신 chat ID (숫자 또는 @username)
            enabled: 봇 활성화 여부
        """
        self.token = token
        self.chat_id = chat_id
        self.channel = None
        self.enabled = enabled and bool(token)
        # allow channel username to be used as default chat target (e.g. @my_channel)
        if isinstance(chat_id, str) and chat_id.startswith("@"):
            self.channel = chat_id
        self.api_url = f"https://api.telegram.org/bot{token}"

    def send_message(
        self,
        text: str,
        parse_mode: str = "HTML",
        chat_id: str | None = None,
    ) -> bool:
        """텍스트 메시지 발송"""
        if not self.enabled:
            logger.warning("Telegram bot disabled or no token provided")
            return False
        target = chat_id or self.chat_id or self.channel
        if not target:
            logger.error("No target chat_id or channel configured for Telegram message")
            return False

        try:
            response = requests.post(
                f"{self.api_url}/sendMessage",
                json={
                    "chat_id": target,
                    "text": text,
                    "parse_mode": parse_mode,
                },
                timeout=5,
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to send telegram message: {e}")
            return False

    def send_signal_alert(
        self,
        market: str,
        signal_type: AlertType,
        probability: float,
        price: float,
        features: Optional[Dict[str, float]] = None,
    ) -> bool:
        """
        거래 신호 알림
        
        Args:
            market: 거래쌍 (e.g., "KRW-BTC")
            signal_type: 신호 유형 (BUY/SELL/HOLD)
            probability: 신뢰도 (0~1)
            price: 현재 가격
            features: 추가 기술 지표
        """
        features = features or {}
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        msg = f"""
<b>{signal_type.value}</b>

📌 <b>마켓:</b> {market}
💰 <b>가격:</b> {price:,.0f}
📈 <b>신뢰도:</b> {probability:.1%}
⏰ <b>시간:</b> {timestamp}

<b>기술 지표:</b>
"""
        for key, val in features.items():
            if isinstance(val, float):
                msg += f"\n• {key}: {val:.2f}"
            else:
                msg += f"\n• {key}: {val}"

        msg += "\n\n#거래신호 #AI거래"
        return self.send_message(msg)

    def send_risk_alert(
        self,
        alert_type: AlertType,
        portfolio_value: float,
        loss_pct: float,
        at_risk_markets: list,
        risk_level: str = "MEDIUM",
    ) -> bool:
        """
        위험 상태 알림
        
        Args:
            alert_type: CRITICAL_LOSS, OVERHEATING 등
            portfolio_value: 포트폴리오 가치
            loss_pct: 손실률
            at_risk_markets: 위험한 마켓 목록
            risk_level: 위험 수준 (LOW/MEDIUM/HIGH/CRITICAL)
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        risk_emoji = {
            "LOW": "🟢",
            "MEDIUM": "🟡",
            "HIGH": "🔴",
            "CRITICAL": "⚠️",
        }.get(risk_level, "❓")

        msg = f"""
{alert_type.value}

{risk_emoji} <b>위험 수준:</b> {risk_level}
💼 <b>포트폴리오 가치:</b> {portfolio_value:,.0f}
📉 <b>손실률:</b> {loss_pct:.2%}
⏰ <b>시간:</b> {timestamp}

<b>위험 마켓:</b>
"""
        for market in at_risk_markets[:5]:  # 상위 5개만 표시
            msg += f"\n• {market}"

        msg += "\n\n#위험알람 #리스크매니징"
        return self.send_message(msg)

    def send_portfolio_update(
        self,
        portfolio: Dict[str, Any],
        total_value: float,
        daily_pnl: float,
    ) -> bool:
        """포트폴리오 상태 업데이트"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        pnl_emoji = "🟢" if daily_pnl >= 0 else "🔴"

        msg = f"""
📊 <b>포트폴리오 업데이트</b>

💼 <b>총 자산:</b> {total_value:,.0f}
{pnl_emoji} <b>일일 손익:</b> {daily_pnl:+,.0f}
⏰ <b>시간:</b> {timestamp}

<b>보유 현황:</b>
"""
        for market, info in list(portfolio.items())[:5]:
            msg += f"\n• {market}: {info.get('quantity', 0):.4f} (수익률: {info.get('return_pct', 0):+.2%})"

        if len(portfolio) > 5:
            msg += f"\n... 외 {len(portfolio) - 5}개"

        msg += "\n\n#포트폴리오"
        return self.send_message(msg)

    def send_command_response(self, command: str, response: Dict[str, Any]) -> bool:
        """명령어 응답 메시지"""
        msg = f"""
<b>명령어 응답: {command}</b>

{response.get('message', 'No response')}
"""
        if "data" in response:
            for key, val in response["data"].items():
                msg += f"\n• {key}: {val}"

        return self.send_message(msg)

    def test_connection(self) -> bool:
        """텔레그램 연결 테스트"""
        try:
            response = requests.post(
                f"{self.api_url}/getMe",
                timeout=5,
            )
            response.raise_for_status()
            logger.info(f"Telegram bot connected: {response.json()['result']['username']}")
            return True
        except Exception as e:
            logger.error(f"Telegram connection test failed: {e}")
            return False

    def send_to_channel(self, channel: str | None = None, text: str = "Test message") -> bool:
        """채널(username 또는 id)로 메시지 전송. 채널에 봇이 초대되어 있고 권한이 필요합니다."""
        target = channel or self.channel
        if not target:
            logger.error("No channel configured to send to")
            return False
        return self.send_message(text=text, chat_id=target)
