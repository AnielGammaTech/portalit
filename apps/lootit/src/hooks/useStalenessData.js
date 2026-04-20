import { useMemo } from 'react';

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(dateB - dateA) / msPerDay);
}

export function useStalenessData({ reviews, snapshotsByRuleId, latestSignOff, allRecons, pax8Recons }) {
  return useMemo(() => {
    const stalenessMap = {};
    const signOffDate = latestSignOff?.signed_at ? new Date(latestSignOff.signed_at) : null;
    const now = new Date();

    const allTiles = (allRecons || []).map((r) => ({
      ruleId: r.rule?.id || r.ruleId,
      psaQty: r.psaQty,
      vendorQty: r.vendorQty,
    }));

    for (const tile of allTiles) {
      const review = (reviews || []).find((r) => r.rule_id === tile.ruleId);
      const snapshot = snapshotsByRuleId?.[tile.ruleId];
      const hasManualAction = review && ['reviewed', 'force_matched', 'dismissed'].includes(review.status);

      let stalenessDays = null;
      let isStale = false;
      let changeDetected = false;
      let previousPsaQty = null;
      let previousVendorQty = null;

      if (hasManualAction && signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (!reviewedAt || reviewedAt < signOffDate) {
          stalenessDays = daysBetween(reviewedAt || signOffDate, now);
          isStale = true;
        }
      } else if (hasManualAction && !signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (reviewedAt) {
          stalenessDays = daysBetween(reviewedAt, now);
          isStale = stalenessDays > 30;
        }
      }

      if (snapshot) {
        const psaChanged = tile.psaQty !== snapshot.psa_qty;
        const vendorChanged = tile.vendorQty !== snapshot.vendor_qty;
        if (psaChanged || vendorChanged) {
          changeDetected = true;
          previousPsaQty = snapshot.psa_qty;
          previousVendorQty = snapshot.vendor_qty;
        }
      }

      if (isStale || changeDetected) {
        stalenessMap[tile.ruleId] = {
          stalenessDays,
          isStale,
          changeDetected,
          previousPsaQty,
          previousVendorQty,
          lastReviewedBy: review?.reviewed_by,
          lastReviewedAt: review?.reviewed_at,
        };
      }
    }

    const staleCount = Object.values(stalenessMap).filter((s) => s.isStale || s.changeDetected).length;

    return { stalenessMap, staleCount };
  }, [reviews, snapshotsByRuleId, latestSignOff, allRecons, pax8Recons]);
}
