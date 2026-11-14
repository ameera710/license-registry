'use strict';

const { Contract } = require('fabric-contract-api');

class LicenseContract extends Contract {
    _requireSCFHS(ctx) {
        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId !== 'SCFHSMSP') {
            throw new Error('Access denied: only SCFHSMSP can modify licenses');
        }
    }

    async IssueLicense(ctx, licenseId, practitionerId, practitionerName, specialty, issueDate, expiryDate) {
        this._requireSCFHS(ctx);

        if ([licenseId, practitionerId, practitionerName, specialty, issueDate, expiryDate]
            .some(value => !value || !value.trim())) {
            throw new Error('All license fields are required');
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
            !Number.isFinite(Date.parse(issueDate)) ||
            !Number.isFinite(Date.parse(expiryDate)) ||
            expiryDate <= issueDate) {
            throw new Error('Invalid license dates');
        }

        const key = ctx.stub.createCompositeKey('license', [licenseId]);
        const existing = await ctx.stub.getState(key);

        if (existing && existing.length > 0) {
            throw new Error(`License ${licenseId} already exists`);
        }

        const license = {
            licenseId,
            practitionerId,
            practitionerName,
            specialty,
            issueDate,
            expiryDate,
            status: 'ACTIVE'
        };

        await ctx.stub.putState(
            key,
            Buffer.from(JSON.stringify(license))
        );

        ctx.stub.setEvent('LicenseIssued', Buffer.from(JSON.stringify({ licenseId, status: license.status })));
        return JSON.stringify(license);
    }

    async RenewLicense(ctx, licenseId, newExpiryDate) {
        this._requireSCFHS(ctx);

        if (!licenseId || !newExpiryDate) {
            throw new Error('License ID and new expiry date are required');
        }

        const key = ctx.stub.createCompositeKey('license', [licenseId]);
        const data = await ctx.stub.getState(key);

        if (!data || data.length === 0) {
            throw new Error(`License ${licenseId} does not exist`);
        }

        const license = JSON.parse(data.toString());

        if (license.status !== 'ACTIVE') {
            throw new Error('Only active licenses can be renewed');
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(newExpiryDate) ||
            !Number.isFinite(Date.parse(newExpiryDate)) ||
            newExpiryDate <= license.expiryDate) {
            throw new Error('New expiry date must be later than current expiry date');
        }

        license.expiryDate = newExpiryDate;

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(license)));

        ctx.stub.setEvent('LicenseRenewed', Buffer.from(JSON.stringify({ licenseId, expiryDate: license.expiryDate })));
        return JSON.stringify(license);
    }


    async SavePrivateLicenseData(ctx, licenseId) {
        this._requireSCFHS(ctx);

        if (!licenseId || !licenseId.trim()) {
            throw new Error('License ID is required');
        }

        const transient = ctx.stub.getTransient();
        const data = transient.get('privateData');

        if (!data || data.length === 0) {
            throw new Error('Private data must be provided through transient input');
        }

        const key = ctx.stub.createCompositeKey('licensePrivate', [licenseId]);

        await ctx.stub.putPrivateData(
            'licensePrivateCollection',
            key,
            data
        );

        return JSON.stringify({ licenseId, saved: true });
    }

}

module.exports = LicenseContract;
