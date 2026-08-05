"""실시간 퀀트 매매 앱 설정 관리."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_markets() -> list[str]:
    raw = os.getenv("MARKETS", "")
    markets = [item.strip() for item in raw.split(",") if item.strip()]
    return markets or ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-SOL", "KRW-ADA"]


@dataclass
class TelegramConfig:
    """텔레그램 알림 설정."""

    TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")
    CHANNEL: str = os.getenv("TELEGRAM_CHANNEL", "")
    ENABLED: bool = bool(os.getenv("TELEGRAM_BOT_TOKEN"))


@dataclass
class TradeConfig:
    """매매 및 모의투자 설정."""

    BASE_THRESHOLD: float = float(os.getenv("BASE_THRESHOLD", 0.60))
    TAKE_PROFIT: float = float(os.getenv("TAKE_PROFIT", 0.02))
    STOP_LOSS: float = float(os.getenv("STOP_LOSS", -0.03))
    MAX_HOLD_MINUTES: int = int(os.getenv("MAX_HOLD_MINUTES", 30))
    SWITCH_MIN_CONFIDENCE_DELTA: float = float(os.getenv("SWITCH_MIN_CONFIDENCE_DELTA", 0.0))
    INITIAL_CAPITAL: float = float(os.getenv("INITIAL_CAPITAL", 5_000_000))
    PAPER_TRADING_ENABLED: bool = _env_bool("PAPER_TRADING_ENABLED", False)
    SIMULATION_INTERVAL_SECONDS: int = int(os.getenv("SIMULATION_INTERVAL_SECONDS", 60))
    FEE_BPS: float = float(os.getenv("FEE_BPS", 5.0))
    MARKETS: list[str] = None

    def __post_init__(self):
        if self.MARKETS is None:
            self.MARKETS = _env_markets()


@dataclass
class RiskConfig:
    """리스크 관리 기본값."""

    POSITION_SIZES = {
        "conservative": {"high_confidence": 0.3, "medium": 0.2, "low": 0.0},
        "neutral": {"high_confidence": 0.5, "medium": 0.3, "low": 0.1},
        "aggressive": {"high_confidence": 0.6, "medium": 0.4, "low": 0.2},
    }

    CONFIDENCE_LEVELS = {
        "high": (0.75, 1.0),
        "medium": (0.60, 0.75),
        "low": (0.50, 0.60),
    }

    ALERT_THRESHOLDS = {
        "critical_loss": -0.05,
        "max_dd": -0.10,
        "overheating": 0.95,
    }

    MEMORY_LIMIT_MB: int = int(os.getenv("MEMORY_LIMIT_MB", 4096))
    CONCURRENT_MARKETS: int = int(os.getenv("CONCURRENT_MARKETS", 5))
    LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", 7))


@dataclass
class CloudConfig:
    """클라우드 배포 참고 설정. 앱에서 클라우드 API를 직접 호출하지는 않음."""

    PROVIDER: str = os.getenv("CLOUD_PROVIDER", "oracle")
    ORACLE_HOME_REGION: str = os.getenv("ORACLE_HOME_REGION", "ap-seoul-1")
    ORACLE_SHAPE: str = os.getenv("ORACLE_SHAPE", "VM.Standard.A1.Flex")
    ORACLE_OCPU: int = int(os.getenv("ORACLE_OCPU", 2))
    ORACLE_MEMORY_GB: int = int(os.getenv("ORACLE_MEMORY_GB", 12))


@dataclass
class AppConfig:
    """애플리케이션 설정."""

    DEBUG: bool = _env_bool("DEBUG", False)
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    MODEL_FILE: str = os.getenv("MODEL_FILE", "models/feature_selected_realtime_model.pkl")

    telegram: TelegramConfig = None
    trade: TradeConfig = None
    risk: RiskConfig = None
    cloud: CloudConfig = None

    def __post_init__(self):
        self.telegram = TelegramConfig()
        self.trade = TradeConfig()
        self.risk = RiskConfig()
        self.cloud = CloudConfig()
        self.aws = self.cloud  # 기존 헬퍼 코드와의 호환을 위한 별칭임.

    @classmethod
    def from_env(cls) -> "AppConfig":
        return cls()


config = AppConfig.from_env()
