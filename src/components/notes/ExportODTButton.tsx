import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import type { StructuredNote } from '@/hooks/useStructuredNotes';
import { useODTExport } from '@/hooks/useODTExport';

interface ExportODTButtonProps {
  notes: StructuredNote[];
  title?: string;
  /** Currently selected filter tags to include in the export header */
  filterTags?: string[];
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

export function ExportODTButton({
  notes,
  title,
  filterTags,
  variant = 'outline',
  className,
}: ExportODTButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { exportToODT } = useODTExport();
  const { toast } = useToast();

  const handleExport = async () => {
    if (notes.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No notes to export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      await exportToODT(notes, title, filterTags);
      toast({
        title: 'Export successful',
        description: `Exported ${notes.length} note(s) as ODT document.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description:
          error instanceof Error ? error.message : 'Failed to export notes.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting || notes.length === 0}
      variant={variant}
      className={className}
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      {isExporting ? 'Exporting...' : `Export ODT (${notes.length})`}
    </Button>
  );
}
