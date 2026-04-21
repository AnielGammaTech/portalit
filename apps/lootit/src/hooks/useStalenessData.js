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

    // Sign-off expiry: customer-level, shared across all tiles
    const daysSinceSignOff = signOffDate ? daysBetween(signOffDate, now) : null;
    const nextReconDate = latestSignOff?.next_reconciliation_date ? new Date(latestSignOff.next_reconciliation_date) : null;
    const signOffExpired = nextReconDate
      ? now >= nextReconDate
      : (daysSinceSignOff === null || daysSinceSignOff >= 30);

    const allTiles = [
      ...(allRecons || []).map((r) => ({ ruleId: r.rule?.id || r.ruleId, psaQty: r.psaQty, vendorQty: r.rawVendorQty ?? r.vendorQty })),
      ...(pax8Recons || []).map((r) => ({ ruleId: r.ruleId, psaQty: r.psaQty, vendorQty: r.vendorQty })),
    ];

    for (const tile of allTiles) {
      const review = (reviews || []).find((r) => r.rule_id === tile.ruleId);
      const snapshot = snapshotsByRuleId?.[tile.ruleId];
      const hasManualAction = review && ['reviewed', 'force_matched', 'dismissed'].includes(review.status);

      let stalenessDays = null;
      let isStale = false;
      let changeDetected = false;
      let previousPsaQty = null;
      let previousVendorQty = null;
      const staleReasons = [];

      // Existing staleness logic (review age vs sign-off)
      if (hasManualAction && signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (!reviewedAt || reviewedAt < signOffDate) {
          stalenessDays = daysBetween(reviewedAt || signOffDate, now);
          isStale = true;
          staleReasons.push('review_stale');
        }
      } else if (hasManualAction && !signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (reviewedAt) {
          stalenessDays = daysBetween(reviewedAt, now);
          isStale = stalenessDays > 30;
          if (isStale) staleReasons.push('review_stale');
        }
      }

      // Force-match staleness: flag when sign-off is expired
      if (review?.status === 'force_matched' && signOffExpired) {
        isStale = true;
        if (!staleReasons.includes('review_stale')) {
          stalenessDays = daysSinceSignOff ?? daysBetween(new Date(review.reviewed_at), now);
        }
        staleReasons.push('force_match_stale');
      }

      // Exclusion staleness: exclusion_verified_at > 90 days ago
      let exclusionStale = false;
      let exclusionDaysSinceVerified = null;
      if (review?.exclusion_count > 0) {
        const verifiedAt = review.exclusion_verified_at
          ? new Date(review.exclusion_verified_at)
          : review.updated_date
            ? new Date(review.updated_date)
            : review.created_date
              ? new Date(review.created_date)
              : null;
        if (verifiedAt) {
          exclusionDaysSinceVerified = daysBetween(verifiedAt, now);
          exclusionStale = exclusionDaysSinceVerified >= 90;
          if (exclusionStale) {
            isStale = true;
            staleReasons.push('exclusion_stale');
          }
        }
      }

      // Change detection (existing logic)
      if (snapshot) {
        const psaChanged = tile.psaQty !== snapshot.psa_qty;
        const vendorChanged = tile.vendorQty !== snapshot.vendor_qty;
        if (psaChanged || vendorChanged) {
          changeDetected = true;
          previousPsaQty = snapshot.psa_qty;
          previousVendorQty = snapshot.vendor_qty;
          staleReasons.push('data_changed');
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
          staleReasons,
          exclusionStale,
          exclusionDaysSinceVerified,
          forceMatchStale: staleReasons.includes('force_match_stale'),
        };
      }
    }

    const staleCount = Object.values(stalenessMap).filter((s) => s.isStale || s.changeDetected).length;

    return { stalenessMap, staleCount, signOffExpired, daysSinceSignOff };
  }, [reviews, snapshotsByRuleId, latestSignOff, allRecons, pax8Recons]);
}
