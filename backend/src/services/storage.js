// Receipt images in Azure Blob Storage (Azurite emulator locally).
const crypto = require('crypto');
const path = require('path');
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob');
const config = require('../config');

let container;

async function getContainer() {
  if (!config.storageConnectionString) return null;
  if (!container) {
    const svc = BlobServiceClient.fromConnectionString(config.storageConnectionString);
    container = svc.getContainerClient(config.receiptsContainer);
    await container.createIfNotExists(); // private by default
  }
  return container;
}

async function uploadReceipt(userId, file) {
  const c = await getContainer();
  if (!c) return null;
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const blobName = `${userId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
  await c.getBlockBlobClient(blobName).uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });
  return blobName;
}

// Short-lived read-only link so receipts never need a public container.
async function receiptUrl(blobName) {
  const c = await getContainer();
  if (!c || !blobName) return null;
  return c.getBlobClient(blobName).generateSasUrl({
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: new Date(Date.now() + 15 * 60 * 1000),
  });
}

async function deleteReceipt(blobName) {
  const c = await getContainer();
  if (c && blobName) await c.getBlobClient(blobName).deleteIfExists();
}

module.exports = { uploadReceipt, receiptUrl, deleteReceipt };
