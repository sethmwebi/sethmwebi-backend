/*
  Warnings:

  - The primary key for the `post_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `categoryId` on the `post_categories` table. All the data in the column will be lost.
  - You are about to drop the column `postId` on the `post_categories` table. All the data in the column will be lost.
  - Added the required column `category_id` to the `post_categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `post_id` to the `post_categories` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "post_categories" DROP CONSTRAINT "post_categories_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "post_categories" DROP CONSTRAINT "post_categories_postId_fkey";

-- AlterTable
ALTER TABLE "post_categories" DROP CONSTRAINT "post_categories_pkey",
DROP COLUMN "categoryId",
DROP COLUMN "postId",
ADD COLUMN     "category_id" TEXT NOT NULL,
ADD COLUMN     "post_id" TEXT NOT NULL,
ADD CONSTRAINT "post_categories_pkey" PRIMARY KEY ("post_id", "category_id");

-- AddForeignKey
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
