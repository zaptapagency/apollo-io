import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';
import { VerifyEmailResult } from '@prospect/shared';

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  '10minutemail.com',
  'throwaway.email',
  'maildrop.cc',
  'mailinator.com',
  'yopmail.com',
]);

const ROLE_BASED_PATTERNS = /^(info|support|sales|noreply|no-reply|hello|contact|help|admin|team|all)@/i;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  async verifyEmail(email: string): Promise<VerifyEmailResult> {
    const parts = email.split('@');
    const domain = parts[1];

    if (!domain) {
      return {
        email,
        status: 'INVALID',
        score: 0,
        mxFound: false,
        isDisposable: false,
        isRoleBased: false,
        isCatchAll: false,
      };
    }

    const isDisposable = DISPOSABLE_DOMAINS.has(domain.toLowerCase());
    const isRoleBased = ROLE_BASED_PATTERNS.test(email);

    // DNS MX check with timeout
    let mxFound = false;
    let isCatchAll = false;

    try {
      const mxRecords = await this.resolveMX(domain);
      mxFound = mxRecords.length > 0;
      // Catch-all check: in production, would perform SMTP verification
      // For now, assume no catch-all (conservative approach)
      isCatchAll = false;
    } catch (error) {
      this.logger.warn(`MX lookup failed for ${domain}: ${error}`);
      mxFound = false;
    }

    // Determine status based on heuristics
    let status: 'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN' = 'UNKNOWN';
    let score = 0;

    if (!email.includes('@') || email.split('@').length !== 2) {
      status = 'INVALID';
      score = 0;
    } else if (isDisposable) {
      status = 'RISKY';
      score = 0.3;
    } else if (!mxFound) {
      // If MX lookup failed but email format is valid, mark as UNKNOWN (not INVALID)
      // This preserves confidence for role-based/personal emails that couldn't be verified
      if (isRoleBased) {
        status = 'VALID';
        score = 0.6;
      } else {
        status = 'UNKNOWN';
        score = 0.5;
      }
    } else if (isRoleBased) {
      status = 'VALID';
      score = 0.6; // Role-based is valid but less personally targeted
    } else if (mxFound) {
      status = 'VALID';
      score = 0.95;
    }

    return {
      email,
      status,
      score,
      mxFound,
      isDisposable,
      isRoleBased,
      isCatchAll,
    };
  }

  private async resolveMX(domain: string | undefined): Promise<Array<{ priority: number; exchange: string }>> {
    if (!domain) return [];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('MX lookup timeout'));
      }, 2000);

      dns.resolveMx(domain)
        .then((records) => {
          clearTimeout(timer);
          resolve(records || []);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
