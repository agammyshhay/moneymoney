import { OutputVendorName, type Exporter } from '../../types';
import EditFileExporter from './EditFileExporter';

export interface EditExporterProps {
  handleSave: (exporterConfig: Exporter) => Promise<void>;
  exporter: Exporter;
}

export default function EditExporter({ handleSave, exporter }: EditExporterProps) {
  const exporterTypeToEditComponent = new Map<string, JSX.Element>();
  exporterTypeToEditComponent.set(
    OutputVendorName.JSON,
    <EditFileExporter exporter={exporter} handleSave={handleSave} />,
  );
  return <>{exporterTypeToEditComponent.get(exporter.companyId)}</>;
}
