import * as RNIap from 'react-native-iap';
import { Platform } from 'react-native';
import { Query } from 'react-native-appwrite';
import { SubscriptionEntitlement, SubscriptionPlan } from '@domain/entities';
import { BillingRepository } from '@domain/repositories';
import {
  PREMIUM_BASE_PLAN_ID,
  PREMIUM_BILLING_PERIOD,
  PREMIUM_OFFER_ID,
  PREMIUM_PRICE_CENTS,
  PREMIUM_PRICE_FORMATTED,
  PREMIUM_PRODUCT_ID,
  PREMIUM_TRIAL_DAYS,
} from '@shared/constants/billing';
import { SUBSCRIPTION_DISCLOSURE } from '@shared/constants/disclaimers';
import { account, databases, functions, DATABASE, COLLECTIONS } from '@infra/appwrite/client';
import { mapEntitlement } from '@infra/appwrite/mappers';
import { ownerOnly } from '@infra/appwrite/permissions';

const VERIFY_FUNCTION_ID = 'verify-purchase';

export class GooglePlayBillingRepository implements BillingRepository {
  private initialized = false;

  private async ensureInit() {
    if (this.initialized) return;
    if (Platform.OS !== 'android') {
      // iOS path TBD; on Android-first launch we still no-op gracefully on other platforms.
      this.initialized = true;
      return;
    }
    await RNIap.initConnection();
    this.initialized = true;
  }

  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    await this.ensureInit();
    let priceFormatted = PREMIUM_PRICE_FORMATTED;
    let priceCents = PREMIUM_PRICE_CENTS;
    let currency = 'USD';
    try {
      if (Platform.OS === 'android') {
        const subs = await RNIap.getSubscriptions({ skus: [PREMIUM_PRODUCT_ID] });
        const sub = subs?.[0] as any;
        const offer = sub?.subscriptionOfferDetails?.[0];
        const phase = offer?.pricingPhases?.pricingPhaseList?.find(
          (p: any) => p.priceAmountMicros && Number(p.priceAmountMicros) > 0
        );
        if (phase) {
          priceFormatted = phase.formattedPrice ?? priceFormatted;
          priceCents = Math.round(Number(phase.priceAmountMicros) / 10000);
          currency = phase.priceCurrencyCode ?? currency;
        }
      }
    } catch {
      // Use defaults; Play config may not be ready in dev.
    }
    return [
      {
        productId: PREMIUM_PRODUCT_ID,
        basePlanId: PREMIUM_BASE_PLAN_ID,
        offerId: PREMIUM_OFFER_ID,
        priceFormatted,
        priceCents,
        currency,
        freeTrialDays: PREMIUM_TRIAL_DAYS,
        billingPeriod: PREMIUM_BILLING_PERIOD,
        disclosure: SUBSCRIPTION_DISCLOSURE,
      },
    ];
  }

  async purchasePremiumMonthly(): Promise<void> {
    await this.ensureInit();
    if (Platform.OS !== 'android') {
      throw new Error('Premium subscription is currently available only on Android.');
    }
    const subs = (await RNIap.getSubscriptions({ skus: [PREMIUM_PRODUCT_ID] })) as any[];
    const sub = subs?.[0];
    if (!sub) throw new Error('Subscription product not available. Verify Play Console setup.');
    const offerToken =
      sub.subscriptionOfferDetails?.find((o: any) => o.offerId === PREMIUM_OFFER_ID)
        ?.offerToken ?? sub.subscriptionOfferDetails?.[0]?.offerToken;
    await RNIap.requestSubscription({
      sku: PREMIUM_PRODUCT_ID,
      ...(offerToken
        ? { subscriptionOffers: [{ sku: PREMIUM_PRODUCT_ID, offerToken }] }
        : {}),
    } as any);
    // Purchase event will be picked up via purchaseUpdatedListener — but we also try a sync now.
    await this.syncEntitlement();
  }

  async restorePurchases(): Promise<void> {
    await this.ensureInit();
    if (Platform.OS !== 'android') return;
    const purchases = await RNIap.getAvailablePurchases();
    for (const p of purchases) {
      await this.sendTokenToServer((p as any).purchaseToken, (p as any).productId);
    }
    await this.syncEntitlement();
  }

  async syncEntitlement(): Promise<SubscriptionEntitlement | null> {
    try {
      const me = await account.get();
      // Trigger server-side verification (idempotent).
      try {
        await functions.createExecution(VERIFY_FUNCTION_ID, JSON.stringify({ userId: me.$id }));
      } catch {
        // function may be absent in dev
      }
      const res = await databases.listDocuments(DATABASE, COLLECTIONS.entitlements, [
        Query.equal('userId', me.$id),
        Query.orderDesc('lastVerifiedAt'),
        Query.limit(1),
      ]);
      if (res.documents.length === 0) return null;
      return mapEntitlement(res.documents[0] as any);
    } catch {
      return null;
    }
  }

  async getCurrentEntitlement(): Promise<SubscriptionEntitlement | null> {
    return this.syncEntitlement();
  }

  private async sendTokenToServer(purchaseToken: string, productId: string) {
    const me = await account.get();
    try {
      await databases.createDocument(
        DATABASE,
        COLLECTIONS.purchase_records,
        'unique()',
        {
          userId: me.$id,
          platform: 'google_play',
          productId,
          purchaseToken,
          receivedAt: new Date().toISOString(),
        },
        ownerOnly(me.$id)
      );
    } catch {
      // purchase already recorded
    }
  }
}
