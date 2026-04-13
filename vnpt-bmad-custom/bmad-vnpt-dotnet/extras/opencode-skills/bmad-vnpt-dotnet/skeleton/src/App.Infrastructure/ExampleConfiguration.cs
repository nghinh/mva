using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace App.Infrastructure.Persistence.Configurations;

public sealed class ExampleConfiguration : IEntityTypeConfiguration<ExampleEntity>
{
    public void Configure(EntityTypeBuilder<ExampleEntity> builder)
    {
        builder.ToTable("examples");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => x.Name);
    }
}

public sealed class ExampleEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
