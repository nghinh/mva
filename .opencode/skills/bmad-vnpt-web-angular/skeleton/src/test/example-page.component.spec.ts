import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExamplePageComponent } from '../app/features/example/pages/example-page.component';

describe('ExamplePageComponent', () => {
  let fixture: ComponentFixture<ExamplePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamplePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExamplePageComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
