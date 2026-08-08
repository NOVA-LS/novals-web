-- Las preguntas dejan de vivir solo en el código: se pueden editar desde el
-- panel. Todo nulo salvo el orden, así que las filas que ya existen siguen
-- sirviendo el formulario del fichero hasta que alguien lo toque.
ALTER TABLE "FormConfig" ADD COLUMN "title" TEXT;
ALTER TABLE "FormConfig" ADD COLUMN "summary" TEXT;
ALTER TABLE "FormConfig" ADD COLUMN "fields" JSONB;
ALTER TABLE "FormConfig" ADD COLUMN "version" INTEGER;
ALTER TABLE "FormConfig" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
