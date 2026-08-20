'use server';

/**
 * Public estimate actions.
 *
 * Server actions files can only export async
 * functions, so we wrap the actions from
 * lib/estimates/actions in local async functions
 * that pass through the args. The forms in
 * PublicEstimateView call these directly.
 */

import {
  publicApproveEstimateAction as _approve,
  publicRejectEstimateAction as _reject,
} from '@/lib/estimates/actions';

export async function publicApproveEstimateAction(
  prev: unknown,
  formData: FormData,
) {
  return _approve(prev as never, formData);
}

export async function publicRejectEstimateAction(
  prev: unknown,
  formData: FormData,
) {
  return _reject(prev as never, formData);
}
