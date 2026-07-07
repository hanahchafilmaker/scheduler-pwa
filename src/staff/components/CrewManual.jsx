import React from 'react';

const CrewManual = () => {
  return (
    <div className="crew-manual">
      <div className="crew-manual-header">
        <h1>크루 매뉴얼</h1>
        <p>직원 필수 가이드라인 및 작업 절차</p>
      </div>

      <div className="crew-manual-content">
        <section className="manual-section">
          <h2>1. 근무 기본 수칙</h2>
          <ul>
            <li>출근 전 개인 위생 체크 (손 소독, 머리정리)</li>
            <li>지각 시 반드시 사전 연락 필수</li>
            <li>근무 중 개인 휴대폰 사용 금지</li>
            <li> teammate와의 원활한 소통 유지</li>
            <li>청결하고 안전한 작업 환경 유지</li>
          </ul>
        </section>

        <section className="manual-section">
          <h2>2. 복장 및 위생 기준</h2>
          <ul>
            <li>제복은 깨끗하고 깔끔하게 착용</li>
            <li>머리는 깨끗이 묶고, 액세서리는 최소화</li>
            <li>손톱은 짧게 유지하고 손톱 색칠 금지</li>
            <li>작업 전후 손 소독 필수</li>
            <li>음식 취급 시 장갑 착용 필수</li>
          </ul>
        </section>

        <section className="manual-section">
          <h2>3. 고객 응대 매뉴얼</h2>
          <ul>
            <li>인사: 밝은 표정과 함께 "어서오세요!"</li>
            <li>주문 받기: 고객 눈높이에 맞춰 경청</li>
            <li>불만 처리: 먼저 공감 후 해결 방안 제시</li>
            <li>Insincere 사과 금지 - 진심 어린 사과만이 신뢰 회복</li>
            <li>퇴장 인사: "감사합니다. 또 오세요!"</li>
          </ul>
        </section>

        <section className="manual-section">
          <h2>4. 비상 상황 대처법</h2>
          <ul>
            <li>화재: nearest 소화기 사용 및 119 신고</li>
            <li>부상: 구급상자로 1차 처리 후 병원 후송 판단</li>
            <li>정전: 비상등 확인 및 고객 안전 유도</li>
            <li>손님 충돌: 차분히 상황 설명 후 매니저 호출</li>
          </ul>
        </section>

        <section className="manual-section">
          <h2>5. 청소 및 위생 관리</h2>
          <ul>
            <li>작업 전후 담당 구역 청소 필수</li>
            <li>주방: 기름때 제거 및 소독 정기 수행</li>
            <li>홀: 테이블 및 의자 청결 유지</li>
            <li>화실: 비누 및 휴지 보충 확인</li>
            <li>폐기물: 분리수거 규정 준수</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default CrewManual;