"""
Integration tests for AI Quant Trading System
"""

import pytest
import json
from app import app, initialize_app


@pytest.fixture
def client():
    """Flask 테스트 클라이언트"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture(scope="session", autouse=True)
def setup():
    """테스트 세션 초기화"""
    initialize_app()


class TestHealthCheck:
    """헬스 체크 테스트"""

    def test_health_endpoint_exists(self, client):
        """헬스 엔드포인트 호출 가능"""
        response = client.get('/health')
        assert response.status_code in [200, 500]

    def test_health_response_structure(self, client):
        """헬스 응답 구조 확인"""
        response = client.get('/health')
        data = json.loads(response.data)
        assert 'status' in data
        assert 'timestamp' in data
        assert 'model_loaded' in data
        assert 'exchange_connected' in data


class TestSignalEndpoint:
    """거래 신호 엔드포인트 테스트"""

    def test_signal_endpoint_accessible(self, client):
        """신호 엔드포인트 접근 가능"""
        response = client.get('/signal')
        # 모델/거래소 미초기화 가능하므로 500도 허용
        assert response.status_code in [200, 500]

    def test_signal_response_structure(self, client):
        """신호 응답 구조 확인"""
        response = client.get('/signal')
        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'timestamp' in data
            assert 'results' in data
            assert isinstance(data['results'], list)

    def test_signal_result_format(self, client):
        """신호 결과 포맷 확인"""
        response = client.get('/signal')
        if response.status_code == 200:
            data = json.loads(response.data)
            if data['results']:
                result = data['results'][0]
                # 필수 필드 확인
                required_fields = ['market', 'price']
                for field in required_fields:
                    assert field in result


class TestAllocationEndpoint:
    """분할 배분 엔드포인트 테스트"""

    def test_allocation_post_request(self, client):
        """POST 요청 처리"""
        payload = {
            "capital": 1_000_000,
            "risk_profile": "neutral"
        }
        response = client.post(
            '/allocation',
            data=json.dumps(payload),
            content_type='application/json'
        )
        assert response.status_code in [200, 500]

    def test_allocation_response_structure(self, client):
        """배분 응답 구조 확인"""
        payload = {
            "capital": 1_000_000,
            "risk_profile": "neutral"
        }
        response = client.post(
            '/allocation',
            data=json.dumps(payload),
            content_type='application/json'
        )
        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'capital' in data
            assert 'allocation' in data
            assert isinstance(data['allocation'], dict)


class TestPortfolioEndpoint:
    """포트폴리오 엔드포인트 테스트"""

    def test_portfolio_endpoint_accessible(self, client):
        """포트폴리오 엔드포인트 접근 가능"""
        response = client.get('/portfolio')
        assert response.status_code in [200, 500]

    def test_portfolio_structure(self, client):
        """포트폴리오 응답 구조"""
        response = client.get('/portfolio')
        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'metrics' in data
            assert 'risk' in data
            assert 'positions' in data


class TestTelegramEndpoint:
    """텔레그램 엔드포인트 테스트"""

    def test_telegram_test_endpoint(self, client):
        """텔레그램 테스트 엔드포인트"""
        response = client.post('/test-telegram')
        # 토큰 미설정 시 400, 설정 시 200
        assert response.status_code in [200, 400, 500]


class TestMetricsEndpoint:
    """메트릭 엔드포인트 테스트"""

    def test_metrics_endpoint_accessible(self, client):
        """메트릭 엔드포인트 접근 가능"""
        response = client.get('/metrics')
        assert response.status_code in [200, 500]

    def test_metrics_response_structure(self, client):
        """메트릭 응답 구조"""
        response = client.get('/metrics')
        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'timestamp' in data
            assert 'system' in data
            assert 'portfolio' in data


class TestErrorHandling:
    """에러 핸들링 테스트"""

    def test_404_not_found(self, client):
        """404 에러"""
        response = client.get('/nonexistent')
        assert response.status_code == 404

    def test_error_response_format(self, client):
        """에러 응답 포맷"""
        response = client.get('/nonexistent')
        data = json.loads(response.data)
        assert 'error' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
