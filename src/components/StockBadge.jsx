/** 재고 부족 배지: 색상과 함께 기호·텍스트로 상태를 표시 */
export default function StockBadge({ item }) {
  if (item.quantity === 0) {
    return <span className="badge badge-out">× 품절</span>;
  }
  if (item.isLow) {
    return <span className="badge badge-warn">! 재고 부족</span>;
  }
  return null;
}
