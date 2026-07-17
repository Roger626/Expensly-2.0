import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CleanupTask } from './cleanup.task';

@Module({
  imports: [StorageModule],
  providers: [CleanupTask],
})
export class TasksModule {}
