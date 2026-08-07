/*
  Warnings:

  - Added the required column `pdf_url` to the `reports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "pdf_url" TEXT NOT NULL;
