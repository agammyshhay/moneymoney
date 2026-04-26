import {
  type Config,
  type EnrichedTransaction,
  type ExportTransactionsResult,
  type OutputVendorName,
} from '@/backend/commonTypes';
import {
  AccountStatus,
  EventNames,
  ExporterEndEvent,
  ExporterEvent,
  type EventPublisher,
} from '@/backend/eventEmitters/EventEmitter';
import outputVendors from '@/backend/export/outputVendors';
import _ from 'lodash';
import logger from '/@/logging/logger';

type ExecutionResult = Partial<Record<OutputVendorName, ExportTransactionsResult>>;

export async function createTransactionsInExternalVendors(
  outputVendorsConfig: Config['outputVendors'],
  companyIdToTransactions: Record<string, EnrichedTransaction[]>,
  startDate: Date,
  eventPublisher: EventPublisher,
) {
  await eventPublisher.emit(EventNames.EXPORT_PROCESS_START);
  const executionResult: ExecutionResult = {};
  const allTransactions = _.flatten(Object.values(companyIdToTransactions));

  const exportPromises = outputVendors
    .filter((outputVendor) => outputVendorsConfig[outputVendor.name]?.active)
    .map(async (outputVendor) => {
      const baseEvent = {
        exporterName: outputVendor.name,
        allTransactions,
      };

      await outputVendor.init?.(outputVendorsConfig);
      await eventPublisher.emit(EventNames.EXPORTER_START, new ExporterEvent({ message: 'Starting', ...baseEvent }));
      try {
        const exportTransactionsResult = await outputVendor.exportTransactions(
          {
            transactionsToCreate: allTransactions,
            startDate,
            outputVendorsConfig,
          },
          eventPublisher,
        );
        await eventPublisher.emit(
          EventNames.EXPORTER_END,
          new ExporterEndEvent({
            message: 'Finished',
            ...baseEvent,
            status: AccountStatus.DONE,
            exportedTransactionsNum: exportTransactionsResult.exportedTransactionsNum,
            newTransactions: exportTransactionsResult.newTransactions,
          }),
        );
        executionResult[outputVendor.name] = exportTransactionsResult;
      } catch (e) {
        logger.error('Failed to create transactions in external vendors', e);
        const err = e as Error & { errorType?: string; statusCode?: number };
        const msg = err.message ?? '';
        let errorType = err.errorType;
        if (!errorType) {
          if (err.statusCode === 401 || err.statusCode === 403 || /\b(401|403|unauthor|forbidden)\b/i.test(msg)) {
            errorType = 'BASE44_AUTH';
          } else if (/ECONN|ENOTFOUND|ETIMEDOUT|fetch failed|network/i.test(msg)) {
            errorType = 'BASE44_NETWORK';
          } else {
            errorType = 'EXPORT_GENERIC';
          }
        }
        await eventPublisher.emit(
          EventNames.EXPORTER_ERROR,
          new ExporterEvent({
            message: msg,
            error: err,
            status: AccountStatus.ERROR,
            errorType,
            ...baseEvent,
          }),
        );
        throw e;
      }
    });

  await Promise.all(exportPromises);
  if (!Object.keys(executionResult).length) {
    const error = new Error('You need to set at least one output vendor to be active');
    throw error;
  }

  await eventPublisher.emit(EventNames.EXPORT_PROCESS_END);
  return executionResult;
}
